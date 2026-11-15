# Selene Horizon

Interactive lunar south pole mission planner visualizing NASA solar illumination, terrain horizon obstruction, and direct-to-Earth communications with scalable technical depth.

---

## Overview

Selene Horizon is an open-source mission planning and visualization tool designed for lunar south pole operations. By integrating publicly available NASA planetary datasets, topocentric terrain models, and ephemeris calculations, the application overlays critical environmental constraints onto an interactive spatial interface. 

To accommodate a broad spectrum of aerospace stakeholders, the interface features a multi-tiered comprehension toggle. Users can dynamically switch between high-level mission summaries and granular orbital mechanics parameters without altering the underlying simulation state.

## Key Capabilities

* **Solar Illumination Modeling:** Calculates time-resolved solar elevation angles, shadow casting, and Permanently Shadowed Region (PSR) boundaries across lunar south pole topography.
* **Horizon Obstruction Analysis:** Generates 360-degree terrain elevation masks from user-defined surface coordinates to identify line-of-sight blockages caused by crater rims and ridges.
* **Direct-to-Earth (DTE) Communications:** Evaluates Earth visibility windows, elevation angles above the local horizon, and link-budget line-of-sight availability.
* **Adaptive Comprehension Levels:** Provides three distinct operational views:
  * *Overview Mode:* Simplified visual overlays and plain-language summaries for mission concept design and educational outreach.
  * *Operations Mode:* Standard telemetry plots, surface traverse timelines, and communication window schedules.
  * *Engineering Mode:* Raw ephemeris vectors, topocentric azimuth/elevation matrices, and terrain Digital Elevation Model (DEM) profiles.

## Data Sources and Standards

Selene Horizon relies on validated NASA open-source data and standard aerospace coordinate frames:

* **Topography:** Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA) Digital Elevation Models.
* **Ephemeris:** JPL Horizons / NAIF SPICE kernels (DE440/DE441) for Sun, Earth, and Moon state vectors.
* **Coordinate Systems:** Mean Earth/Polar Axis (ME) body-fixed lunar coordinates and local East-North-Up (ENU) topocentric frames.

## Architecture and Installation

### Prerequisites

* [Specify Runtime, e.g., Node.js >= 18.0 or Python >= 3.10]
* [Specify Package Manager, e.g., npm, pip, or conda]
* [Specify Hardware/Browser Requirements, e.g., WebGL 2.0 compatible browser]

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com<organization>/selene-horizon.git
   cd selene-horizon
   ```

2. Install dependencies:
   ```bash
   # Replace with your project's install command
   npm install
   ```

3. Configure environment variables and NASA data endpoints:
   ```bash
   cp .env.example .env
   ```

4. Launch the application:
   ```bash
   npm run dev
   ```

## Deploying to Vercel via GitHub

The codebase is pre-configured with `vercel.json` and `/api/index.ts` so both the Vite client-side SPA and the NASA backend proxy routes work seamlessly on Vercel without separate servers or CORS errors.

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Selene Horizon"
   git branch -M main
   git remote add origin https://github.com/<your-username>/selene-horizon.git
   git push -u origin main
   ```

2. **Import into Vercel:**
   * Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** > **"Project"**.
   * Select your GitHub repository and click **"Import"**.

3. **Verify Project Settings (handled automatically by `vercel.json`):**
   * **Framework Preset:** `Vite`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
   * **Root Directory:** `./`

4. **Deploy:**
   * Click **"Deploy"**.
   * Vercel builds the static bundle to edge storage and mounts `/api/*` (JPL Horizons ephemeris proxy, LOLA DEM parser, Moon Trek tile cache, and Artemis region outlines) as a serverless function. No environment variables are required.

## Usage

1. **Select Region of Interest:** Input target latitude and longitude coordinates within the lunar south pole region (e.g., Shackleton Crater rim, Connecting Ridge) or select a preset landing site.
2. **Define Mission Epoch:** Set the simulation start date, duration, and temporal resolution step size.
3. **Configure Comprehension Tier:** Use the top-level interface toggle to select *Overview*, *Operations*, or *Engineering* data density.
4. **Export Mission Data:** Download visibility timelines, horizon masks, and illumination profiles in standard CSV or JSON formats for external trajectory or power-budget analysis.

## Verification and Validation

Simulation outputs are benchmarked against JPL Horizons ephemeris tables and published LOLA illumination maps. Unit tests for coordinate transformations and ray-casting algorithms can be executed via:

```bash
# Replace with your project's test command
npm test
```

## Contributing

Contributions to physics modeling, terrain rendering performance, and dataset integration are welcome. Please review `CONTRIBUTING.md` for coding standards, pull request procedures, and verification requirements prior to submitting changes.

## License

This project is licensed under the [Apache License 2.0 / NASA Open Source Agreement / MIT License] - see the `LICENSE` file for details.

## Acknowledgments

* NASA Lunar Reconnaissance Orbiter (LRO) / LOLA Science Team for high-resolution lunar topography datasets.
* NASA Jet Propulsion Laboratory (JPL) Navigation and Ancillary Information Facility (NAIF) for SPICE toolkit standards and ephemeris data.