import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory caches for live NASA responses
const horizonsCache = new Map<string, { data: unknown; ts: number }>();
const demCache = new Map<string, { data: unknown; ts: number }>();
const tileCache = new Map<string, { buf: Buffer; contentType: string; ts: number }>();
let artemisRegionsCache: { data: unknown; ts: number } | null = null;

const ALLOWED_WMTS_LAYERS = new Set([
  'LRO_LOLA_ClrShade_SPole75_30mp_v04',
  'LRO_LOLA_ClrShade_SPole875_5mp_v04',
  'LRO_WAC_Mosaic_SPole60_100m_v02',
  'WAC_POLE_ILL_PCT_SOUTH_100M',
  'ClrAVGVISIB_75S_120M_201608_EARTH_SP',
]);

const MOON_RADIUS_M = 1737400.0;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function latLonToPolarMeters(latDeg: number, lonDeg: number): [number, number] {
  const rM = 2 * MOON_RADIUS_M * Math.tan(((90 + latDeg) * DEG2RAD) / 2);
  const lonRad = lonDeg * DEG2RAD;
  return [rM * Math.sin(lonRad), rM * Math.cos(lonRad)];
}

function polarMetersToLatLon(xM: number, yM: number): { lat: number; lon: number } {
  const rM = Math.hypot(xM, yM);
  const lat = -90 + 2 * Math.atan(rM / (2 * MOON_RADIUS_M)) * RAD2DEG;
  let lon = Math.atan2(xM, yM) * RAD2DEG;
  if (lon < 0) lon += 360;
  return { lat, lon };
}

function pointInPoly(pt: [number, number], poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0],
      yi = poly[i][1];
    const xj = poly[j][0],
      yj = poly[j][1];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Parses an uncompressed little-endian Float32 TIFF (tiled or stripped) returned by NASA Moon Trek ImageServer.
 */
function parseFloat32GeoTiff(buf: Buffer): { width: number; height: number; floats: Float32Array } {
  const magic = buf.toString('ascii', 0, 2);
  if (magic !== 'II') {
    throw new Error('Unexpected TIFF byte order (expected little-endian II).');
  }
  const ifdOffset = buf.readUInt32LE(4);
  const entryCount = buf.readUInt16LE(ifdOffset);

  let width = 0;
  let height = 0;
  let tileW = 0;
  let tileH = 0;
  let tileOffsetsPtr = 0;
  let tileOffsetsCount = 0;
  let stripOffsetsPtr = 0;
  let stripOffsetsCount = 0;
  let rowsPerStrip = 0;

  for (let i = 0; i < entryCount; i++) {
    const off = ifdOffset + 2 + i * 12;
    const tag = buf.readUInt16LE(off);
    const type = buf.readUInt16LE(off + 2);
    const count = buf.readUInt32LE(off + 4);
    const valOrOff = buf.readUInt32LE(off + 8);

    if (tag === 256) width = type === 3 ? buf.readUInt16LE(off + 8) : valOrOff;
    else if (tag === 257) height = type === 3 ? buf.readUInt16LE(off + 8) : valOrOff;
    else if (tag === 273) {
      stripOffsetsCount = count;
      stripOffsetsPtr = count === 1 ? off + 8 : valOrOff;
    } else if (tag === 278) {
      rowsPerStrip = type === 3 ? buf.readUInt16LE(off + 8) : valOrOff;
    } else if (tag === 322) {
      tileW = type === 3 ? buf.readUInt16LE(off + 8) : valOrOff;
    } else if (tag === 323) {
      tileH = type === 3 ? buf.readUInt16LE(off + 8) : valOrOff;
    } else if (tag === 324) {
      tileOffsetsCount = count;
      tileOffsetsPtr = count === 1 ? off + 8 : valOrOff;
    }
  }

  if (!width || !height) {
    throw new Error('Missing image dimensions in LOLA GeoTIFF.');
  }

  const floats = new Float32Array(width * height);

  if (tileOffsetsCount > 0 && tileW > 0 && tileH > 0) {
    const tilesX = Math.ceil(width / tileW);
    for (let t = 0; t < tileOffsetsCount; t++) {
      const offset = buf.readUInt32LE(tileOffsetsPtr + t * 4);
      const tx = (t % tilesX) * tileW;
      const ty = Math.floor(t / tilesX) * tileH;
      for (let r = 0; r < tileH && ty + r < height; r++) {
        for (let c = 0; c < tileW && tx + c < width; c++) {
          const bytePos = offset + (r * tileW + c) * 4;
          if (bytePos + 4 <= buf.length) {
            floats[(ty + r) * width + (tx + c)] = buf.readFloatLE(bytePos);
          }
        }
      }
    }
  } else if (stripOffsetsCount > 0) {
    const rps = rowsPerStrip || height;
    for (let s = 0; s < stripOffsetsCount; s++) {
      const offset = buf.readUInt32LE(stripOffsetsPtr + s * 4);
      const yStart = s * rps;
      for (let r = 0; r < rps && yStart + r < height; r++) {
        for (let c = 0; c < width; c++) {
          const bytePos = offset + (r * width + c) * 4;
          if (bytePos + 4 <= buf.length) {
            floats[(yStart + r) * width + c] = buf.readFloatLE(bytePos);
          }
        }
      }
    }
  } else {
    throw new Error('Unsupported LOLA GeoTIFF layout.');
  }

  return { width, height, floats };
}

/**
 * 1. NASA JPL Horizons API Proxy (Sun & Earth topocentric ephemeris on the Moon)
 */
app.get(['/api/horizons', '/horizons'], async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const elevKm = Number(req.query.elevKm ?? 0);
    const startTime = String(req.query.startTime ?? '');
    const stopTime = String(req.query.stopTime ?? '');
    const stepSize = String(req.query.stepSize ?? '6 h');
    const target = req.query.target === '399' ? '399' : '10';

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !startTime || !stopTime) {
      res.status(400).json({ error: 'Missing required parameters: lat, lon, startTime, stopTime.' });
      return;
    }

    const cacheKey = `${target}|${lat.toFixed(3)}|${lon.toFixed(3)}|${elevKm.toFixed(2)}|${startTime}|${stopTime}|${stepSize}`;
    const cached = horizonsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 30 * 60 * 1000) {
      res.json(cached.data);
      return;
    }

    const formatHorizonsTime = (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toISOString().slice(0, 16).replace('T', ' ');
    };

    const params = new URLSearchParams({
      format: 'json',
      COMMAND: `'${target}'`,
      OBJ_DATA: 'NO',
      MAKE_EPHEM: 'YES',
      EPHEM_TYPE: 'OBSERVER',
      CENTER: `'coord@301'`,
      COORD_TYPE: 'GEODETIC',
      SITE_COORD: `'${lon.toFixed(4)},${lat.toFixed(4)},${elevKm.toFixed(3)}'`,
      START_TIME: `'${formatHorizonsTime(startTime)}'`,
      STOP_TIME: `'${formatHorizonsTime(stopTime)}'`,
      STEP_SIZE: `'${stepSize}'`,
      QUANTITIES: `'4'`,
      CSV_FORMAT: 'YES',
    });

    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    const upstream = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!upstream.ok) {
      res.status(502).json({ error: `NASA JPL Horizons returned HTTP ${upstream.status}.` });
      return;
    }

    const data = (await upstream.json()) as { result?: string; error?: string };
    if (data.error || !data.result) {
      res.status(502).json({ error: data.error || 'NASA JPL Horizons returned an empty response.' });
      return;
    }

    const payload = {
      source: 'NASA JPL Horizons System (DE441 Ephemeris)',
      citationUrl: 'https://ssd.jpl.nasa.gov/horizons/',
      target: target === '10' ? 'Sun' : 'Earth',
      result: data.result,
    };
    horizonsCache.set(cacheKey, { data: payload, ts: Date.now() });
    res.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown upstream error';
    res.status(502).json({ error: `Unable to reach NASA JPL Horizons (${message}).` });
  }
});

/**
 * 2. NASA Moon Trek Artemis III Candidate Landing Regions GeoJSON + LOLA Ridge Crest Snapping
 */
app.get(['/api/nasa/artemis-regions', '/nasa/artemis-regions'], async (_req, res) => {
  try {
    if (artemisRegionsCache && Date.now() - artemisRegionsCache.ts < 60 * 60 * 1000) {
      res.json(artemisRegionsCache.data);
      return;
    }

    const url =
      'https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions_SP/MapServer/0/query?where=1%3D1&outFields=*&f=geojson';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const upstream = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!upstream.ok) {
      res.status(502).json({ error: `NASA Moon Trek returned HTTP ${upstream.status}` });
      return;
    }

    const geojson = (await upstream.json()) as {
      features: Array<{
        properties: Record<string, unknown>;
        geometry: { type: string; coordinates: number[][][] };
      }>;
    };

    // Snap each Artemis III region's target point to the highest LOLA elevation crest inside its polygon
    const enrichedFeatures = await Promise.all(
      (geojson.features ?? []).map(async (f) => {
        try {
          const ringLonLat = f.geometry?.coordinates?.[0] ?? [];
          const polyXY = ringLonLat.map(([lon, lat]) => latLonToPolarMeters(lat, lon));
          let minX = 1e9,
            maxX = -1e9,
            minY = 1e9,
            maxY = -1e9;
          for (const [x, y] of polyXY) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          const pts: Array<[number, number]> = [];
          for (let gx = 0; gx <= 5; gx++) {
            for (let gy = 0; gy <= 5; gy++) {
              const px = minX + (gx / 5) * (maxX - minX);
              const py = minY + (gy / 5) * (maxY - minY);
              if (pointInPoly([px, py], polyXY)) pts.push([Math.round(px), Math.round(py)]);
            }
          }
          if (pts.length === 0) {
            pts.push([Math.round((minX + maxX) / 2), Math.round((minY + maxY) / 2)]);
          }
          const geom = encodeURIComponent(JSON.stringify({ points: pts }));
          const sampRes = await fetch(
            `https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole75_30mp_v04/ImageServer/getSamples?geometry=${geom}&geometryType=esriGeometryMultipoint&returnFirstValueOnly=true&f=json`
          );
          if (sampRes.ok) {
            const sampJson = (await sampRes.json()) as {
              samples?: Array<{ value: string; location: { x: number; y: number } }>;
            };
            let best: { v: number; x: number; y: number } | null = null;
            for (const s of sampJson.samples ?? []) {
              const v = Number(s.value);
              if (Number.isFinite(v) && (!best || v > best.v)) {
                best = { v, x: s.location.x, y: s.location.y };
              }
            }
            if (best) {
              const ll = polarMetersToLatLon(best.x, best.y);
              return {
                ...f,
                properties: {
                  ...f.properties,
                  crestLat: Number(ll.lat.toFixed(4)),
                  crestLon: Number(ll.lon.toFixed(3)),
                  crestElevM: Math.round(best.v),
                },
              };
            }
          }
        } catch {
          // Keep original properties if LOLA crest lookup fails
        }
        return f;
      })
    );

    const payload = {
      source: 'NASA Moon Trek — Artemis III Candidate Landing Regions (A3_Named_regions_SP)',
      citationUrl: 'https://trek.nasa.gov/moon/',
      geojson: { ...geojson, features: enrichedFeatures },
    };
    artemisRegionsCache = { data: payload, ts: Date.now() };
    res.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: `Unable to load Artemis III regions (${message}).` });
  }
});

/**
 * 3. NASA Moon Trek Multi-Resolution LRO LOLA DEM Grid (Regional 2.1km, Local 280m, Crest 27m via SPole875 5m/px)
 */
app.get(['/api/nasa/lola-dem', '/nasa/lola-dem'], async (req, res) => {
  try {
    const mode =
      req.query.mode === 'crest' ? 'crest' : req.query.mode === 'local' ? 'local' : 'regional';
    let xmin = -273982.5;
    let ymin = -273982.5;
    let xmax = 273982.5;
    let ymax = 273982.5;
    let size = 256;
    let serviceLayer = 'LRO_LOLA_DEM_SPole75_30mp_v04';

    if (mode === 'local' || mode === 'crest') {
      const cx = Number(req.query.x ?? 0);
      const cy = Number(req.query.y ?? 0);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
        res.status(400).json({ error: 'Invalid x/y coordinates for LOLA DEM.' });
        return;
      }
      const halfSpan = mode === 'crest' ? 3500 : 36000;
      const maxExtent =
        mode === 'crest' && Math.hypot(cx, cy) < 71000 ? 75780 : 457440;
      if (mode === 'crest' && Math.hypot(cx, cy) < 71000) {
        serviceLayer = 'LRO_LOLA_DEM_SPole875_5mp_v04';
      }
      xmin = Math.max(-maxExtent, cx - halfSpan);
      xmax = Math.min(maxExtent, cx + halfSpan);
      ymin = Math.max(-maxExtent, cy - halfSpan);
      ymax = Math.min(maxExtent, cy + halfSpan);
      size = 256;
    }

    const cacheKey = `${serviceLayer}|${mode}|${Math.round(xmin)}|${Math.round(ymin)}|${Math.round(xmax)}|${Math.round(ymax)}`;
    const cached = demCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 60 * 60 * 1000) {
      res.json(cached.data);
      return;
    }

    const url = `https://trek.nasa.gov/moon/trekarcgis/rest/services/${serviceLayer}/ImageServer/exportImage?bbox=${xmin},${ymin},${xmax},${ymax}&size=${size},${size}&format=tiff&pixelType=F32&compression=NONE&f=image`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    const upstream = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!upstream.ok) {
      res.status(502).json({ error: `NASA LOLA DEM ImageServer returned HTTP ${upstream.status}` });
      return;
    }

    const arrBuf = await upstream.arrayBuffer();
    const { width, height, floats } = parseFloat32GeoTiff(Buffer.from(arrBuf));

    const payload = {
      source: `NASA LRO LOLA DEM (${serviceLayer})`,
      citationUrl: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm',
      width,
      height,
      bbox: { xmin, ymin, xmax, ymax },
      elevationsBase64: Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength).toString(
        'base64'
      ),
    };
    demCache.set(cacheKey, { data: payload, ts: Date.now() });
    res.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: `Unable to fetch NASA LOLA DEM (${message}).` });
  }
});

/**
 * 4. NASA Moon Trek WMTS Tile Proxy
 */
app.get(
  ['/api/nasa/tile/:layer/:z/:row/:col', '/nasa/tile/:layer/:z/:row/:col'],
  async (req, res) => {
  try {
    const { layer, z, row, col } = req.params;
    if (!ALLOWED_WMTS_LAYERS.has(layer)) {
      res.status(400).json({ error: 'Unsupported NASA Moon Trek layer.' });
      return;
    }
    const cleanCol = col.replace(/\.png$/i, '');
    const cacheKey = `${layer}/${z}/${row}/${cleanCol}`;
    const cached = tileCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached.buf);
      return;
    }

    const tileUrl = `https://trek.nasa.gov/tiles/Moon/SP/${layer}/1.0.0/default/default028mm/${z}/${row}/${cleanCol}.png`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const upstream = await fetch(tileUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'image/png';
    tileCache.set(cacheKey, { buf, contentType, ts: Date.now() });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch {
    res.status(502).end();
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Selene Horizon server listening on http://0.0.0.0:${PORT}`);
  });
}

// Export express app for Vercel serverless integration, tests, and modular imports
export { app };
export default app;

if (!process.env.VERCEL) {
  startServer();
}
