import { ComprehensionLevel } from './comprehension';

export interface MathEquationSpec {
  label: string;
  latex: string;
  note?: string;
}

export interface LeveledExplanation {
  title: string;
  paragraph: string;
  equations?: MathEquationSpec[];
}

export type LeveledContentMap = Record<ComprehensionLevel, LeveledExplanation>;

export const MATH_CONTENT: Record<
  | 'datafeeds'
  | 'telemetry'
  | 'panorama'
  | 'skydome'
  | 'polarmap'
  | 'timeline'
  | 'sitenotes'
  | 'tradeSpace'
  | 'jplVerify'
  | 'customMask'
  | 'ephemTable'
  | 'guideSun'
  | 'guideEarth'
  | 'guideArray',
  LeveledContentMap
> = {
  datafeeds: {
    'high-school': {
      title: 'How NASA maps and Sun/Earth tracking work together',
      paragraph: String.raw`Every reading combines real Moon elevation maps from NASA's Lunar Reconnaissance Orbiter laser altimeter (LOLA) with NASA's official Sun and Earth sky positions so you can see when craters block sunlight or radio signals.`,
      equations: [
        {
          label: 'Simple Line-of-Sight Clearance Check',
          latex: String.raw`\text{Sky Angle} - \text{Terrain Height Angle} \ge \text{Safety Margin}`,
          note: String.raw`If the Sun or Earth is higher in degrees than the tallest mountain peak in that direction, light or radio signals get through.`,
        },
      ],
    },
    collegiate: {
      title: 'How live LOLA topography & JPL ephemeris combine',
      paragraph: String.raw`Each calculation pairs multi-resolution NASA Moon Trek $5\text{ m/px}$ and $30\text{ m/px}$ LOLA elevation rasters with topocentric Sun and Earth positions validated live against NASA JPL Horizons DE441.`,
      equations: [
        {
          label: 'Curved-Moon Horizon Obstruction Check',
          latex: String.raw`\text{El}_{\text{body}} - \theta_{\text{mask}}(\text{Az}) \ge \Delta\theta_{\text{margin}}, \qquad \Delta h_{\text{curv}}(d) = \frac{d^2}{2 R_{\text{Moon}}}`,
          note: String.raw`Ray-marching accounts for lunar spherical curvature ($R_{\text{Moon}} = 1737.4\text{ km}$) and lander mast height $h_{\text{mast}}$.`,
        },
      ],
    },
    graduate: {
      title: 'Multi-tier DEM ray-marching & DE441 frame coupling',
      paragraph: String.raw`Terrain occlusion profiles fuse three nested Moon Trek stereographic tiers ($27\text{ m/px}$ crest, $280\text{ m/px}$ local, $2.1\text{ km/px}$ regional Float32 GeoTIFFs) with IAU 2015 body-fixed ephemeris vectors audited against JPL DE441.`,
      equations: [
        {
          label: 'Geodesic Sightline & Curvature Correction',
          latex: String.raw`\theta_{\text{mask}}(\alpha) = \max_{d \in [0.15,\, 112]\text{ km}} \arctan\!\left(\frac{h_{\text{LOLA}}(\psi, \alpha) - (h_0 + h_{\text{mast}}) - d^2/(2R_{\text{Moon}})}{d}\right)`,
          note: String.raw`Angular separation $\psi = d/R_{\text{Moon}}$ samples bilinearly across the highest-resolution DEM tier available at distance $d$.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Flight-dynamics data provenance: LOLA GDR & IAU 2015 / DE441',
      paragraph: String.raw`Horizon masks resolve steep polar ridges without sub-grid smoothing by prioritizing LRO LOLA $5\text{ m/px}$ (` + '`SPole875_5mp_v04`' + String.raw`) in the near field ($0.15$–$3.1\text{ km}$) over $30\text{ m/px}$ (` + '`SPole75_30mp_v04`' + String.raw`) massif horizons out to $112\text{ km}$, synchronized with topocentric ` + '`coord@301`' + String.raw` Horizons ephemeris.`,
      equations: [
        {
          label: 'Curved Tangent Horizon Operator on $S^2$',
          latex: String.raw`\theta_{\text{mask}}(\alpha) = \sup_{s \in [0.15,\,112]\text{ km}} \arctan\!\left(\frac{\mathcal{I}_{\text{bilin}}\big(h_{\text{LOLA}},\, \exp_{p_0}(s\hat{t}_\alpha)\big) - (h_0 + h_{\text{mast}}) - \frac{s^2}{2 R_{\text{Moon}}}}{s}\right)`,
          note: String.raw`Prevents false positive masking inside deep crater walls (e.g., Shackleton interior) while maintaining $\le 0.03^\circ$ angular residual vs. DE441.`,
        },
      ],
    },
  },

  telemetry: {
    'high-school': {
      title: 'What these four live numbers & power/comms equations mean',
      paragraph: String.raw`Topocentric Solar Elev tells you how high the Sun is above the surrounding crater walls ('Mask'). Array Power Density estimates how many watts of sunlight hit each square meter of solar panel right now. Earth DTE Elevation checks whether an antenna can point straight at Earth without hitting a mountain (plus the $1.28$-second radio travel time, OWLT).`,
      equations: [
        {
          label: 'Solar Power on Vertical vs. Flat Panels',
          latex: String.raw`P_{\text{array}} = 1361 \times (\text{Visible Sun Fraction}) \times \begin{cases} 1 & \text{if sun-tracking upright} \\ \sin(\text{Sun Angle}) & \text{if lying flat} \end{cases}`,
          note: String.raw`At $1.5^\circ$ above the horizon, $\sin(1.5^\circ) \approx 0.026$, so a flat panel captures under $3\%$ of sunlight while a vertical tracking panel captures $\approx 100\%$.`,
        },
        {
          label: 'Radio Signal Travel Time to Earth (OWLT)',
          latex: String.raw`\text{OWLT} = \frac{\text{Distance to Earth}}{299{,}792.458\text{ km/s}} \approx 1.28\text{ s}`,
          note: String.raw`Even at the speed of light, live voice and video take about $1.28$ seconds one way from Moon to Earth.`,
        },
      ],
    },
    collegiate: {
      title: 'Solar disc grazing physics, DTE margin & OWLT equations',
      paragraph: String.raw`Because the Sun has a $0.53^\circ$ angular diameter ($\rho_\odot \approx 0.266^\circ$), power ramps smoothly across a crater rim rather than switching off instantaneously. Direct-to-Earth (DTE) links require Earth's elevation to exceed the northern terrain mask plus the RF clearance margin.`,
      equations: [
        {
          label: 'Circular-Segment Solar Disc Fraction & Array Flux',
          latex: String.raw`f_{\text{disc}}(u) = 1 - \frac{\arccos(u) - u\sqrt{1 - u^2}}{\pi}, \qquad P_{\text{array}} = \frac{1361}{d_{\text{AU}}^2}\, f_{\text{disc}}(u) \cdot \begin{cases} 1 & \text{tracking} \\ \max(0, \sin \text{El}_\odot) & \text{horizontal} \end{cases}`,
          note: String.raw`Normalized limb offset $u = \operatorname{clamp}\!\big((\text{El}_\odot - \theta_{\text{mask}}(\text{Az}_\odot) - \delta_\odot)/\rho_\odot,\, -1,\, 1\big)$ integrates the exposed photosphere chord.`,
        },
        {
          label: 'Direct-to-Earth Horizon Clearance & One-Way Light Time',
          latex: String.raw`\Delta\theta_{\text{DTE}} = \text{El}_\oplus - \theta_{\text{mask}}(\text{Az}_\oplus) \ge \delta_\oplus, \qquad \tau_{\text{OWLT}} = \frac{\|\vec{r}_\oplus - \vec{r}_{\text{obs}}\|}{c}`,
          note: String.raw`At lunar perigee/apogee ($\sim 356{,}400$ to $406{,}700\text{ km}$), $\tau_{\text{OWLT}}$ varies between $1.19\text{ s}$ and $1.36\text{ s}$.`,
        },
      ],
    },
    graduate: {
      title: 'Topocentric photometric occultation & S-band/Ka-band LOS link criteria',
      paragraph: String.raw`Photovoltaic yield models penumbral limb occultation as a circular segment cut by the azimuth-interpolated LOLA knife-edge horizon, coupled with $1/d_{\text{AU}}^2$ heliocentric flux scaling. Telemetry availability tests Earth topocentric elevation against north-facing massif clearance and computes geometric OWLT.`,
      equations: [
        {
          label: 'Penumbral Knife-Edge Irradiance & Array Projection',
          latex: String.raw`u = \operatorname{clip}_{[-1,1]}\!\left(\frac{\text{El}_\odot - \theta_{\text{mask}}(\text{Az}_\odot) - \delta_\odot}{\arcsin(R_\odot/d_\odot)}\right), \qquad P_{\text{array}} = \frac{S_0}{d_{\text{AU}}^2}\left(1 - \frac{\arccos u - u\sqrt{1-u^2}}{\pi}\right)\cos\iota`,
          note: String.raw`Here $\cos\iota = 1$ for sun-tracking vertical wings and $\cos\iota = \max(0,\sin\text{El}_\odot)$ for deck-mounted horizontal arrays.`,
        },
        {
          label: 'DTE Clearance Inequality & Light-Time Range',
          latex: String.raw`\text{El}_\oplus(t) - \theta_{\text{mask}}\big(\text{Az}_\oplus(t)\big) \ge \delta_\oplus, \qquad \tau_{\text{OWLT}}(t) = \frac{\|\mathbf{R}_{\text{BF}}(t)\vec{r}_{\text{Moon}\to\oplus}(t) - \vec{r}_{\text{obs}}\|}{c}`,
          note: String.raw`Clearance margin $\delta_\oplus$ budgets Fresnel zone diffraction and high-gain antenna pointing jitter.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Topocentric irradiance integration, RF diffraction margin & range-time delay',
      paragraph: String.raw`Instantaneous array irradiance integrates uniform solar-disc photospheric occultation across the local LOLA horizon tangent plane without atmospheric refraction, parameterized by heliocentric inverse-square attenuation and tracking incidence cosine. Earth DTE state evaluates S/Ka-band RF clearance against near-side topography.`,
      equations: [
        {
          label: 'Geometric Limb-Occulted Solar Flux & Incidence Operator',
          latex: String.raw`P_{\text{array}}(t) = \frac{S_0}{r_{\odot\text{AU}}^2(t)}\left[1 - \frac{\cos^{-1}(u) - u\sqrt{1-u^2}}{\pi}\right]_{u=\operatorname{sat}\!\left(\frac{\text{El}_\odot - \theta_{\text{eff}}}{\rho_\odot}\right)} \cdot \begin{cases} 1 & \text{vertical tracking} \\ \max(0,\sin\text{El}_\odot) & \text{zenith normal} \end{cases}`,
          note: String.raw`Effective mask threshold $\theta_{\text{eff}}(\text{Az}_\odot) = \theta_{\text{mask}}(\text{Az}_\odot) + \delta_\odot$, with solar constant $S_0 = 1361\text{ W/m}^2$.`,
        },
        {
          label: 'Topocentric Earth Link Condition & Proper Light Time',
          latex: String.raw`\Delta\theta_{\text{DTE}}(t) = \arcsin\!\left(\frac{\hat{u}_{\text{up}}\cdot\vec{\Delta r}_\oplus}{\|\vec{\Delta r}_\oplus\|}\right) - \theta_{\text{mask}}(\text{Az}_\oplus) \ge \delta_\oplus, \qquad \tau_{\text{OWLT}}(t) = \frac{\|\vec{\Delta r}_\oplus(t)\|}{c}`,
          note: String.raw`Assumes vacuum propagation ($n=1$) and IAU 2015 PA/ME station coordinates $(R_m + h_0, \phi, \lambda)$.`,
        },
      ],
    },
  },

  panorama: {
    'high-school': {
      title: 'How the 360° Horizon Panorama, Moon curve & Sun–Earth paths connect',
      paragraph: String.raw`Think of standing on a lunar ridge and spinning slowly in a full circle from North ($0^\circ$) to East ($90^\circ$), South ($180^\circ$), and West ($270^\circ$). The dark gray jagged wall is the height of surrounding crater rims. Because the Moon is small ($R_{\text{Moon}} = 1737.4\text{ km}$), distant mountains curve downward out of sight faster than on Earth. Whenever the yellow Sun curve or blue Earth loop rises above that mountain line, you have power or Earth radio contact!`,
      equations: [
        {
          label: 'How Much Moon Curvature Drops Distant Mountains',
          latex: String.raw`\text{Curvature Drop} = \frac{d^2}{2 R_{\text{Moon}}}, \qquad \text{Mountain Angle} = \arctan\!\left(\frac{\text{Mountain Height} - \text{Your Height} - \text{Drop}}{d}\right)`,
          note: String.raw`A peak $10\text{ km}$ away already drops $\approx 29\text{ m}$ due to the Moon's curve; a peak $100\text{ km}$ away drops $\approx 2{,}880\text{ m}$!`,
        },
        {
          label: 'Comparing Sun & Earth Angles to the Horizon',
          latex: String.raw`\text{Clearance Margin} = \text{Body Elevation Angle} - \text{Horizon Mask Angle}`,
          note: String.raw`Positive clearance ($>0^\circ$) means direct sunlight or clear radio communication; negative means the mountain blocks the view.`,
        },
      ],
    },
    collegiate: {
      title: 'Spherical lunar curvature & topocentric Sun–Earth horizon geometry',
      paragraph: String.raw`This $360^\circ$ cylindrical panorama unwraps local horizon obstructions around the compass ($\text{Az} \in [0^\circ, 360^\circ)$) alongside the apparent paths of the Sun and Earth. Because lunar radius $R_{\text{Moon}} = 1737.4\text{ km}$ is $27\%$ of Earth's radius, spherical curvature significantly depresses far-field massifs, letting high ridges like Connecting Ridge achieve negative horizon masks.`,
      equations: [
        {
          label: 'Spherical Curvature Drop & Ray-Marched Horizon Mask',
          latex: String.raw`\Delta h_{\text{curv}}(d) = \frac{d^2}{2 R_{\text{Moon}}}, \qquad \theta_{\text{mask}}(\alpha) = \max_{d \in [0.15,\,112]\text{ km}} \arctan\!\left(\frac{h_{\text{LOLA}}(\psi,\alpha) - (h_0 + h_{\text{mast}}) - \dfrac{d^2}{2 R_{\text{Moon}}}}{d}\right)`,
          note: String.raw`Great-circle step $\psi = d/R_{\text{Moon}}$ samples elevation from $150\text{ m}$ foreground boulders out to $112\text{ km}$ crater rims.`,
        },
        {
          label: 'Topocentric East-North-Up (ENU) Azimuth & Elevation',
          latex: String.raw`\text{El} = \arcsin\!\left(\frac{U}{\|\vec{\Delta r}\|}\right), \qquad \text{Az} = \operatorname{atan2}(E, N) \bmod 360^\circ`,
          note: String.raw`Local $(E,N,U)$ components tie both Sun solar-flux incidence and Earth DTE clearance directly to the same $360^\circ$ terrain curve.`,
        },
      ],
    },
    graduate: {
      title: 'Great-circle horizon ray-marching & IAU 2015 ENU frame transformations',
      paragraph: String.raw`Equirectangular sky-track projection plots topocentric Sun and Earth ephemeris trajectories computed via the IAU 2015 Mean-Earth/Polar-Axis rotation matrix $\mathbf{R}_{\text{BF}}(\alpha_0, \delta_0, W)$ against great-circle tangent horizon angles ray-marched across nested NASA LOLA DEMs.`,
      equations: [
        {
          label: 'Spherical Ray-March Tangent Elevation Operator',
          latex: String.raw`\hat{p}(d) = \cos\psi\,\hat{r}_0 + \sin\psi\,\hat{t}_\alpha, \quad \psi = \frac{d}{R_{\text{Moon}}}, \qquad \theta_{\text{mask}}(\alpha) = \max_{d} \arctan\!\left(\frac{h_{\text{LOLA}}(\hat{p}) - (h_0 + h_{\text{mast}}) - \frac{d^2}{2R_{\text{Moon}}}}{d}\right)`,
          note: String.raw`Tangent basis $\hat{t}_\alpha = \cos\alpha\,\hat{n}_0 + \sin\alpha\,\hat{e}_0$ advances on the sphere of radius $R_{\text{Moon}} = 1737.4\text{ km}$.`,
        },
        {
          label: 'J2000-to-Body-Fixed ENU Ephemeris Mapping',
          latex: String.raw`\vec{\Delta r}_{\text{BF}} = R_z(W)R_x\!\left(\tfrac{\pi}{2}-\delta_0\right)R_z\!\left(\tfrac{\pi}{2}+\alpha_0\right)\vec{r}_{\text{EQJ}} - \vec{r}_{\text{obs}}, \qquad \Delta\theta_{\text{clear}} = \arcsin\!\left(\frac{U}{\|\vec{\Delta r}\|}\right) - \theta_{\text{mask}}(\text{Az})`,
          note: String.raw`Directly bridges inertial planetary ephemerides with selenographic LOLA digital topography.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Spherical chord horizon formulation & IAU 2015 topocentric ephemeris kinematics',
      paragraph: String.raw`The panorama renders instantaneous topocentric azimuth/elevation loci $(\text{Az}, \text{El})$ in the Mean-Earth/Polar-Axis (IAU 2015 Archinal et al.) reference frame against maximum spherical-chord obstruction angles evaluated along $24$ logarithmic range rings ($0.15\text{ km}$–$112\text{ km}$) over LOLA Float32 elevation fields.`,
      equations: [
        {
          label: 'Curved Horizon Chord Elevation Angle',
          latex: String.raw`\theta_{\text{mask}}(\alpha) = \max_{d_j} \arctan\!\left(\frac{h_{\text{DEM}}(\phi_j,\lambda_j) - (h_0 + h_{\text{mast}}) - \frac{d_j^2}{2R_{\text{Moon}}}}{d_j}\right), \qquad \sin\phi_j = \cos\psi_j\sin\phi_0 + \sin\psi_j\cos\phi_0\cos\alpha`,
          note: String.raw`Log-spaced sampling prevents $280\text{ m}$/pixel discretization aliasing while capturing far-field massif crests past $80\text{ km}$.`,
        },
        {
          label: 'Topocentric Sun/Earth Vector Projection & Occultation State',
          latex: String.raw`\begin{bmatrix}E\\N\\U\end{bmatrix} = \begin{bmatrix}-\sin\lambda & \cos\lambda & 0 \\ -\sin\phi\cos\lambda & -\sin\phi\sin\lambda & \cos\phi \\ \cos\phi\cos\lambda & \cos\phi\sin\lambda & \sin\phi\end{bmatrix} \Big(\mathbf{R}_{\text{BF}}(t)\vec{r}_{\text{EQJ}}(t) - \vec{r}_{\text{obs}}(\phi,\lambda,h_0)\Big)`,
          note: String.raw`Live DE441 checkpoints (` + '`coord@301`' + String.raw`) validate both solar ephemeris parallax and lunar physical libration harmonics $E_1\dots E_{13}$.`,
        },
      ],
    },
  },

  skydome: {
    'high-school': {
      title: 'How this circular radar connects the Sun spiral and Earth loop',
      paragraph: String.raw`Imagine lying on your back at the landing site and looking straight up. The dashed $0^\circ$ circle is a perfectly flat horizon. Near the center ($+10^\circ, +16^\circ$) is higher in the sky, while the outer edge ($-6^\circ$) dips below level. Because the Moon's tilt is tiny ($1.54^\circ$), the Sun circles smoothly all the way around the sky once a month, while Earth always stays near North ($0^\circ\text{ N}$) tracing a monthly figure-eight wobble!`,
      equations: [
        {
          label: 'Where Dots Plot on the Sky Radar',
          latex: String.raw`r(\text{El}) = R_{\text{outer}}\,\frac{16^\circ - \text{El}}{22^\circ}, \qquad (x,y) = r(\text{El})\,(\sin\text{Az},\; -\cos\text{Az})`,
          note: String.raw`Higher elevation means smaller distance $r$ toward the bullseye center; compass direction $\text{Az}$ sets the angle clockwise from North.`,
        },
        {
          label: 'Why the Sun Circles While Earth Stays North',
          latex: String.raw`\text{Sun: }\text{Az}_\odot \in [0^\circ, 360^\circ)\text{ every } 29.53\text{ d} \qquad\text{vs.}\qquad \text{Earth: }\text{Az}_\oplus \approx 0^\circ \pm 7.9^\circ\text{ every } 27.3\text{ d}`,
          note: String.raw`You only get simultaneous solar power and direct Earth comms when BOTH tracks sit inside the clear sky area above the gray terrain ring.`,
        },
      ],
    },
    collegiate: {
      title: 'Polar grazing-elevation transform & coupled Sun–Earth motion',
      paragraph: String.raw`This azimuthal-elevation polar projection magnifies the tight grazing zone ($\text{El} \in [-6^\circ, +16^\circ]$) where lunar south pole operations happen. It reveals the fundamental geometric relationship between the Moon's $1.54^\circ$ axial obliquity (driving the Sun spiral) and the Moon's $5.14^\circ$ orbital inclination and $0.055$ eccentricity (driving Earth's $\pm 6.7^\circ \times \pm 7.9^\circ$ libration figure-eight).`,
      equations: [
        {
          label: 'Polar Azimuthal-Equidistant Sky Mapping',
          latex: String.raw`r(\text{El}) = R_{\text{outer}} \frac{\text{El}_{\max} - \text{El}}{\text{El}_{\max} - \text{El}_{\min}}, \qquad (x,y) = r(\text{El})\,(\sin\text{Az},\; -\cos\text{Az})`,
          note: String.raw`Places $+16^\circ$ at zenith center and $-6^\circ$ on the outer bezel so small terrain height differences ($1^\circ$–$2^\circ$) are easily legible.`,
        },
        {
          label: 'Coupled South Pole Sun & Earth Elevation Approximations',
          latex: String.raw`\text{El}_\odot(t) \approx -(90^\circ + \phi)\cos\text{Az}_\odot + \beta_\odot\sin\!\left(\frac{2\pi t}{T_{\text{syn}}}\right), \qquad \text{El}_\oplus(t) \approx 90^\circ + \phi + \Delta\theta_{\text{lib}}(t)`,
          note: String.raw`With $|\beta_\odot| \le 1.54^\circ$ and $\Delta\theta_{\text{lib}} \in [-6.7^\circ, +6.7^\circ]$, latitudes near $-89^\circ$ require an open northern ($0^\circ$) horizon for Earth DTE.`,
        },
      ],
    },
    graduate: {
      title: 'Grazing sky-dome projection & spin-orbit libration coupling',
      paragraph: String.raw`Truncating radial projection to $[-6^\circ, +16^\circ]$ resolves grazing-incidence solar and RF masks on ridges where horizontal topography spans a few degrees. Solar elevation oscillates with sub-solar ecliptic latitude $\beta_\odot$ ($|\beta_\odot| \le 1.54^\circ$) and synodic rotation, while optical libration in latitude ($i_{\text{orb}} = 5.14^\circ$ + $1.54^\circ$ obliquity) and longitude (Keplerian equation of center $2e\sin M$) governs Earth's locus near $0^\circ\text{ N}$.`,
      equations: [
        {
          label: 'Linear Grazing Radial Metric on Sky Dome',
          latex: String.raw`r(\text{El}) = R_{\text{outer}} \frac{\text{El}_{\max} - \text{El}}{\text{El}_{\max} - \text{El}_{\min}}, \qquad \text{d}s^2 = \left(\frac{R_{\text{outer}}}{\Delta\text{El}}\right)^2\text{d}\text{El}^2 + r(\text{El})^2\text{d}\text{Az}^2`,
          note: String.raw`Preserves true bearing $\text{Az}$ and exaggerates grazing elevation separation around the $0^\circ$ mathematical horizon ring.`,
        },
        {
          label: 'Ephemeris Coupling Between Solar Obliquity & Optical Libration',
          latex: String.raw`\sin\text{El}_\odot = \sin\phi\sin\beta_\odot + \cos\phi\cos\beta_\odot\cos H_\odot, \qquad \text{El}_\oplus \approx (90^\circ+\phi)\cos L_\lambda + L_\phi`,
          note: String.raw`Optical libration in longitude $L_\lambda \approx \pm 7.9^\circ$ and latitude $L_\phi \approx \pm 6.7^\circ$ traces the figure-eight around $0^\circ\text{ N}$ while the Sun traverses hour angle $H_\odot$.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Topocentric polar radar kinematics & Cassini-state libration mechanics',
      paragraph: String.raw`Polar sky-dome coordinates expand the near-horizon celestial annulus ($\text{El} \in [-6^\circ,+16^\circ]$) around selenocentric north. Because the Moon occupies Cassini State 2 ($\varepsilon_M = 1.543^\circ$ fixed to the ecliptic normal alongside $i_M = 5.145^\circ$ orbital inclination), Earth remains quasi-stationary near the sub-Earth $0^\circ\text{ E}$ meridian modulated by draconic and anomalistic libration periods ($27.21\text{ d}$ and $27.55\text{ d}$), while the Sun sweeps $360^\circ$ over $29.5306\text{ d}$.`,
      equations: [
        {
          label: 'Cassini-State Topocentric Elevation Coupling',
          latex: String.raw`\text{El}_\odot(\phi,\lambda,t) = \arcsin\!\big(\sin\phi\sin\delta_\odot + \cos\phi\cos\delta_\odot\cos(\lambda - \lambda_\odot)\big), \quad |\delta_\odot| \le 1.543^\circ`,
          note: String.raw`Small colatitude $\chi = 90^\circ+\phi$ shifts the seasonal bias: closer to $90^\circ\text{S}$, Earth visibility flattens around $\pm 6.7^\circ$ libration while solar symmetry improves.`,
        },
        {
          label: 'Earth Optical & Physical Libration Window',
          latex: String.raw`\text{El}_\oplus(\phi,\lambda,t) = \arcsin\!\big(\sin\phi\sin\phi_\oplus(t) + \cos\phi\cos\phi_\oplus(t)\cos(\lambda - \lambda_\oplus(t))\big)`,
          note: String.raw`Sub-Earth coordinates $(\phi_\oplus,\lambda_\oplus)$ vary within $|\phi_\oplus|\le 6.68^\circ$ and $|\lambda_\oplus|\le 7.9^\circ$, dictating whether near-side craters/massifs block DTE passes.`,
        },
      ],
    },
  },

  polarmap: {
    'high-school': {
      title: 'How the NASA Polar Map flattens the South Pole & casts Sun shadows',
      paragraph: String.raw`Because the Moon is round, flattening the South Pole onto a circle stretches edges slightly unless you use a special pole-centered map called a Polar Stereographic projection (centered at $90^\circ\text{S}$). Clicking any blue Artemis III region jumps straight to its highest sunlit ridge crest, and toggling Shadows computes real-time shadows stretching across craters at your chosen date and hour!`,
      equations: [
        {
          label: 'Flat Polar Map Position from Moon Latitude & Longitude',
          latex: String.raw`r = 2 R_{\text{Moon}} \tan\!\left(\frac{90^\circ + \phi}{2}\right), \qquad (x, y) = \big(r\sin\lambda,\; r\cos\lambda\big)`,
          note: String.raw`Here $\phi$ is South latitude (like $-89.4^\circ$) and $\lambda$ is East longitude. $0^\circ\text{E}$ points straight up toward Earth!`,
        },
        {
          label: 'How Real-Time Sunlight Shadows Are Tested',
          latex: String.raw`\text{Shadowed if } \; h(d) - h_0 - \frac{d^2}{2R_{\text{Moon}}} > d\tan(\text{Sun Elevation})`,
          note: String.raw`If a nearby mountain peak rises higher than a sloped sunlight beam going toward the Sun, that spot on the map is shaded dark.`,
        },
      ],
    },
    collegiate: {
      title: 'Moon2000_spole conformal stereographic math & solar shadow ray-tracing',
      paragraph: String.raw`NASA Moon Trek south-polar WMTS tiles use the conformal South Polar Stereographic projection (` + '`Moon2000_spole`' + String.raw`), which preserves true circular shapes and local bearings. Every candidate site vector combines East longitude $\lambda$ with local body azimuth $\text{Az}$ so Sun and Earth arrows stay aligned with Moon Trek tiles across the polar grid.`,
      equations: [
        {
          label: 'Moon2000_spole Polar Stereographic Mapping',
          latex: String.raw`(x, y) = 2 R_{\text{Moon}} \tan\!\left(\frac{90^\circ + \phi}{2}\right)(\sin\lambda,\; \cos\lambda)`,
          note: String.raw`Maps $+Y$ toward $0^\circ\text{E}$ (sub-Earth Prime Meridian) and $+X$ toward $90^\circ\text{E}$, matching exact Moon Trek GeoTIFF bounds.`,
        },
        {
          label: 'Polar Grid Azimuth Rotation & Curvature Shadow Test',
          latex: String.raw`\hat{u}_{\text{body}} = \big(\sin(\lambda + \text{Az}),\; \cos(\lambda + \text{Az})\big), \qquad h_{\text{LOLA}}(d) - h_0 - \frac{d^2}{2 R_{\text{Moon}}} > d \tan \text{El}_\odot`,
          note: String.raw`Adding $\lambda + \text{Az}$ converts site-local North (which points radially toward the north edge) into global polar-grid $(x,y)$ coordinates.`,
        },
      ],
    },
    graduate: {
      title: 'Conformal south-polar stereographic projection & pixel ray-casting',
      paragraph: String.raw`The Moon2000 South Polar Stereographic tangent-plane projection achieves conformal isotropy with radial colatitude $\chi = 90^\circ+\phi$. Real-time solar illumination shadows are synthesized client-side by ray-marching each map pixel across multi-tier Float32 LOLA DEMs along the topocentric Sun vector $\hat{u}_\odot$ adjusted for $d^2/(2R_{\text{Moon}})$ lunar curvature drop.`,
      equations: [
        {
          label: 'Conformal Polar Stereographic Forward & Scale Metric',
          latex: String.raw`\vec{X}(\phi,\lambda) = 2 R_{\text{Moon}}\tan\!\left(\frac{\chi}{2}\right)\begin{bmatrix}\sin\lambda \\ \cos\lambda\end{bmatrix}, \qquad k(\chi) = \sec^2\!\left(\frac{\chi}{2}\right)`,
          note: String.raw`Between $82^\circ\text{S}$ and $90^\circ\text{S}$ ($\chi \le 8^\circ$), conformal scale distortion $k(\chi) \le 1.0049$ ($<0.5\%$).`,
        },
        {
          label: 'Polar-Frame Bearing Coupling & Shadow Terminator Inequality',
          latex: String.raw`\hat{u}_\odot = \mathbf{R}_z(-\lambda)\begin{bmatrix}\sin\text{Az}_\odot \\ \cos\text{Az}_\odot\end{bmatrix} = \begin{bmatrix}\sin(\lambda+\text{Az}_\odot) \\ \cos(\lambda+\text{Az}_\odot)\end{bmatrix}, \qquad h(\vec{X}+d\hat{u}_\odot) - h(\vec{X}) - \frac{d^2}{2R_{\text{Moon}}} > d\tan\text{El}_\odot`,
          note: String.raw`Ensures pixel-accurate agreement with NASA SVS south pole illumination maps and Moon Trek hillshade rasters.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Moon2000_spole conformal geometry & discrete DEM shadow operator',
      paragraph: String.raw`WMTS tile matrices (` + '`z=3..5`' + String.raw`) register cleanly to ` + '`SPole75`' + String.raw` and ` + '`SPole875`' + String.raw` grids via exact half-sphere stereographic projection on $R_m = 1737.4\text{ km}$. Topocentric azimuths rotate into stereographic map coordinates through meridian angle $\lambda$ (` + '`atan2(x,y)`' + String.raw`), while shadows integrate curved line-of-sight inequalities across pixels.`,
      equations: [
        {
          label: 'Stereographic Coordinate Inverse & Scale Factor on $S^2_{1737.4}$',
          latex: String.raw`\phi = -90^\circ + 2\arctan\!\left(\frac{\sqrt{x^2+y^2}}{2 R_{\text{Moon}}}\right), \quad \lambda = \operatorname{atan2}(x, y) \bmod 360^\circ, \quad k = \frac{4R_m^2 + x^2+y^2}{4R_m^2}`,
          note: String.raw`Direct WMTS Level-$z$ half-extents satisfy $L_z = 273{,}982.5\text{ m} \cdot 2^{-(z-3)}$, guaranteeing zero sub-pixel offset between raster tiles and vector polygons.`,
        },
        {
          label: 'Shadow-Caster Ray-March Operator',
          latex: String.raw`\mathcal{S}(x,y;t) = \mathbf{1}\!\left[\exists\,d_k : \mathcal{I}(h, \vec{X} + d_k \hat{u}_{\odot}) - h(\vec{X}) - \frac{d_k^2}{2R_m} > d_k \tan\text{El}_\odot + \epsilon_{\text{dem}}\right]`,
          note: String.raw`Evaluated across overlapping $27\text{ m/px}$ and $280\text{ m/px}$ Float32 elevation fields with $\epsilon_{\text{dem}} = 20\text{ m}$ sub-pixel noise guard.`,
        },
      ],
    },
  },

  timeline: {
    'high-school': {
      title: 'How power & Earth-link time windows work across days',
      paragraph: String.raw`This chart unrolls your mission from start to finish so you can spot dark eclipses and radio blackouts right away. Whenever the amber Sun line is above its dashed horizon line, solar panels charge batteries. Whenever the blue Earth line is above its dashed line, Earth can hear your spacecraft. Green 'Both Clear' bars mark times when power AND Earth comms work together!`,
      equations: [
        {
          label: 'Counting Both-Clear Operation Time & Total Solar Energy',
          latex: String.raw`\text{Total Solar Energy} = \frac{\text{Average Power (W/m}^2\text{)} \times \text{Mission Hours}}{1000} \;\;[\text{kWh/m}^2]`,
          note: String.raw`Longer gaps in the Sunlit bar tell engineers how big a battery bank is needed to survive lunar night.`,
        },
      ],
    },
    collegiate: {
      title: 'Time-series window gating & cumulative solar energy integral',
      paragraph: String.raw`Unrolling Sun and Earth elevations vs. time lets engineers size batteries for the longest eclipse and schedule high-bandwidth DTE passes. Dashed curves trace the exact LOLA terrain mask plus margin along each body's changing azimuth over time.`,
      equations: [
        {
          label: 'Simultaneous Sun + Direct-to-Earth Window Criterion',
          latex: String.raw`\mathbf{1}_{\text{dual}}(t) = \Big[\text{El}_\odot(t) - \theta_{\text{mask}}(\text{Az}_\odot(t)) \ge \delta_\odot\Big] \;\cdot\; \Big[\text{El}_\oplus(t) - \theta_{\text{mask}}(\text{Az}_\oplus(t)) \ge \delta_\oplus\Big]`,
          note: String.raw`Both bodies must simultaneously exceed their instantaneous directional horizon obstruction masks plus safety margins $\delta_\odot, \delta_\oplus$.`,
        },
        {
          label: 'Cumulative Window Energy Integral',
          latex: String.raw`E_{\text{tot}} = \frac{1}{1000}\int_{t_0}^{t_0 + \Delta t} P_{\text{array}}(t)\,dt \approx \frac{\Delta t}{1000\,N}\sum_{k=1}^{N} P_{\text{array}}(t_k) \;\;[\text{kWh/m}^2]`,
          note: String.raw`Measures total harvestable electrical input energy per square meter of panel over the selected mission duration $\Delta t$.`,
        },
      ],
    },
    graduate: {
      title: 'Temporal window indicators, outage runs & irradiance integration',
      paragraph: String.raw`The timeline maps azimuth-coupled threshold functions $\theta_{\text{eff}}(t) = \theta_{\text{mask}}(\text{Az}(t)) + \delta$ over time $t$. Maximal contiguous complement runs $\max|\{t : \mathbf{1}_{\odot}=0\}|$ determine thermal-survival battery depth-of-discharge requirements and store-and-forward onboard telemetry buffer sizing.`,
      equations: [
        {
          label: 'Dual-Constraint Binary Availability Process',
          latex: String.raw`\mathbf{1}_{\text{dual}}(t) = H\!\big(\text{El}_\odot(t) - \theta_{\text{mask}}(\text{Az}_\odot(t)) - \delta_\odot\big)\,H\!\big(\text{El}_\oplus(t) - \theta_{\text{mask}}(\text{Az}_\oplus(t)) - \delta_\oplus\big)`,
          note: String.raw`Where $H(\cdot)$ is the Heaviside step function evaluating instantaneous solar charging and DTE line-of-sight gating.`,
        },
        {
          label: 'Trapezoidal Window Energy & Battery Outage Duration',
          latex: String.raw`E_{\text{tot}} = \frac{1}{1000}\int_{t_0}^{t_0+\Delta t} P_{\text{array}}(t)\,dt, \qquad T_{\text{dark,max}} = \max_{[a,b]\subset[t_0,t_0+\Delta t]} (b - a) \;\text{s.t.}\; \mathbf{1}_\odot|_{[a,b]} = 0`,
          note: String.raw`Directly governs RTG/battery mass budgets for Artemis surface payloads.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Coupled availability functionals, eclipse run-lengths & energy budget',
      paragraph: String.raw`Because $\text{Az}_\odot(t)$ varies monotonically at $\approx 0.508^\circ/\text{h}$ while $\text{Az}_\oplus(t)$ librates within $\pm 7.9^\circ$ at draconic/anomalistic beat frequencies, the dual-clear indicator $\mathbf{1}_{\text{dual}}(t)$ exhibits strong regional topographic sensitivity. Longest blackout/eclipse durations drive power/comms subsystem sizing.`,
      equations: [
        {
          label: 'Joint Sun–Earth Availability Functional',
          latex: String.raw`\mathcal{A}_{\text{dual}}[t_0,t_0+\Delta t] = \frac{1}{\Delta t}\int_{t_0}^{t_0+\Delta t} \mathbf{1}_{\{\Delta\theta_\odot(t)\ge\delta_\odot\}}\,\mathbf{1}_{\{\Delta\theta_\oplus(t)\ge\delta_\oplus\}}\,dt`,
          note: String.raw`Integrated alongside array fluence $\Phi_{\text{tot}} = 10^{-3}\int P_{\text{array}}(t)\,dt\;\text{kWh/m}^2$ and continuous outage upper bounds.`,
        },
      ],
    },
  },

  sitenotes: {
    'high-school': {
      title: 'Understanding peak Sun/Earth heights, longest darkness & total energy',
      paragraph: String.raw`Peak Sun and Earth angles tell you how high above a flat horizon each target climbs during your trip. Longest Eclipse is the longest continuous time without sunshine (requiring batteries or heaters), and Total Energy is the total sunlight energy hitting one square meter of solar panels.`,
      equations: [
        {
          label: 'Mission Total Energy Formula',
          latex: String.raw`E_{\text{tot}} = \frac{\text{Mean Power (W/m}^2) \times \text{Duration (h)}}{1000}\;\;[\text{kWh/m}^2]`,
          note: String.raw`Even on a dark eclipse day, knowing the peak energy rate helps size solar arrays and batteries.`,
        },
      ],
    },
    collegiate: {
      title: 'Eclipse survival window & cumulative solar energy equations',
      paragraph: String.raw`Peak elevations capture seasonal Sun obliquity plus maximum Earth libration excursion, while Longest Eclipse sets the energy storage threshold for thermal survival between illuminated passes.`,
      equations: [
        {
          label: 'Discrete Mission Energy Integration',
          latex: String.raw`E_{\text{tot}} = \frac{\Delta t}{1000\,N}\sum_{k=1}^{N} P_{\text{array}}(t_k) \;\;[\text{kWh/m}^2]`,
          note: String.raw`Evaluated across $N$ uniformly spaced simulation steps spanning $\Delta t$ hours.`,
        },
      ],
    },
    graduate: {
      title: 'Thermal eclipse constraint & net photovoltaic energy yield',
      paragraph: String.raw`Maximum eclipse span $T_{\text{dark,max}}$ bounds the continuous non-illuminated interval requiring battery/cryogenic survival power, whereas cumulative incident fluence $E_{\text{tot}}$ determines steady-state recharge margin over a synodic cycle.`,
      equations: [
        {
          label: 'Energy Yield & Minimum Storage Margin',
          latex: String.raw`E_{\text{tot}} = \frac{\Delta t}{1000\,N}\sum_{k=1}^{N} P_{\text{array}}(t_k), \qquad E_{\text{batt,min}} \ge \frac{P_{\text{keep-alive}}\,T_{\text{dark,max}}}{\eta_{\text{dis}} \cdot \text{DoD}}`,
          note: String.raw`Relates computed ephemeris dark runs $T_{\text{dark,max}}$ directly to lander battery sizing.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Peak extrema, thermal survival bounds & synoptic fluence integral',
      paragraph: String.raw`Peak solar and Earth elevations capture combined obliquity-colatitude and optical-libration extrema over $[t_0, t_0+\Delta t]$. The maximum contiguous eclipse run $\max T_{\text{dark}}$ constrains non-nuclear thermal survival margins against specific energy limits.`,
      equations: [
        {
          label: 'Synodic Fluence Integral & Survival Bound',
          latex: String.raw`E_{\text{tot}} = \frac{\Delta t}{1000\,N}\sum_{k=1}^{N} P_{\text{array}}(t_k), \qquad \text{DoD}\cdot\eta_{\text{dis}}\,E_{\text{batt}} \ge \int_{t_{\text{eclipse}}} P_{\text{surv}}(t)\,dt`,
          note: String.raw`Computed directly from local horizon-masked irradiance samples without simplifying flat-horizon assumptions.`,
        },
      ],
    },
  },

  tradeSpace: {
    'high-school': {
      title: 'How this Trade-Space Chart compares sites at a glance',
      paragraph: String.raw`Every lander needs two things: steady sunlight (far to the right on the horizontal axis) and a clear view of Earth (high up on the vertical axis). Sites in the green top-right corner like Malapert Massif have great power AND great Earth radio links, while Connecting Ridge reaches $\approx 90\%$ annual sunshine at the far right and sends data when Earth swings above its horizon.`,
      equations: [
        {
          label: 'Combined Power + Earth Link Percentage',
          latex: String.raw`\text{Both Clear \%} = \frac{\text{Hours with Both Sun and Earth Clear}}{\text{Total Mission Hours}} \times 100\%`,
          note: String.raw`Larger circles mean more hours where solar panels charge AND live Earth comms stay active together.`,
        },
      ],
    },
    collegiate: {
      title: 'Trade-space availability & ridge horizon advantage math',
      paragraph: String.raw`The scatter chart visualizes multi-objective site selection across solar illumination duty cycle ($x$-axis) and Direct-to-Earth visibility ($y$-axis). Bubble radius scales with simultaneous Sun + DTE availability across the chosen mission epoch.`,
      equations: [
        {
          label: 'Joint Power + DTE Duty Cycle',
          latex: String.raw`D_{\text{dual}} = \frac{100\%}{N}\sum_{k=1}^{N} \mathbf{1}\!\big(\text{El}_\odot - \theta_{\text{mask}}(\text{Az}_\odot) \ge \delta_\odot\big)\,\mathbf{1}\!\big(\text{El}_\oplus - \theta_{\text{mask}}(\text{Az}_\oplus) \ge \delta_\oplus\big)`,
          note: String.raw`Sites in the green quadrant exceed $75\%$ solar exposure and $50\%$ DTE link availability simultaneously.`,
        },
        {
          label: 'Mean Ridge Horizon Advantage',
          latex: String.raw`\bar{\theta}_{\text{mask}} = \frac{1}{360}\sum_{\alpha=0}^{359} \theta_{\text{mask}}(\alpha)`,
          note: String.raw`Negative mean horizon angles (ridges standing higher than surrounding terrain) yield the longest sunlit windows.`,
        },
      ],
    },
    graduate: {
      title: 'Pareto trade-space formulation & multi-tier LOLA horizon sensitivity',
      paragraph: String.raw`Each site evaluates full $27\text{ m/px}$ crest and $280\text{ m/px}$ local LOLA terrain profiles before comparing Pareto performance between power generation ($D_\odot$) and near-side telemetry ($D_\oplus$). Latitude trade-offs emerge clearly: sites near $85^\circ\text{S}$ gain $5^\circ$ northern Earth elevation over $89.5^\circ\text{S}$ ridges.`,
      equations: [
        {
          label: 'Pareto Simultaneous Duty Metric & Latitude-DTE Gain',
          latex: String.raw`D_{\text{dual}} = \frac{100\%}{N}\sum_{k=1}^{N} \mathbf{1}_{\odot,k}\,\mathbf{1}_{\oplus,k}, \qquad \bar{\text{El}}_\oplus(\phi) \approx 90^\circ + \phi \quad (\phi \in [-90^\circ,-85^\circ])`,
          note: String.raw`Demonstrates why near-side massifs ($\phi \approx -85.5^\circ, \lambda \approx 0^\circ$) sit in the upper DTE band while $89.4^\circ\text{S}$ crests dominate continuous illumination.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Candidate Pareto frontier, ridge-crest DEM Fidelity & DTE relay trade',
      paragraph: String.raw`Site comparisons evaluate identical multi-tier crest-snapped LOLA elevation arrays (` + '`SPole875_5mp`' + String.raw` + ` + '`SPole75_30mp`' + String.raw`) as the single-site planner. This eliminates $280\text{ m}$ crater-averaging bias across narrow crests such as Connecting Ridge while quantifying orbital-relay vs. direct-to-Earth trade boundaries.`,
      equations: [
        {
          label: 'Multi-Objective Joint Availability & Ridge Mask Functional',
          latex: String.raw`\Phi_{\text{Pareto}}(s) = \Big(D_\odot(s),\; D_\oplus(s),\; D_{\text{dual}}(s)\Big), \qquad D_{\text{dual}} = \frac{100\%}{N}\sum_{k=1}^{N}\mathbf{1}_{\{\Delta\theta_\odot \ge \delta_\odot\}}\,\mathbf{1}_{\{\Delta\theta_\oplus \ge \delta_\oplus\}}`,
          note: String.raw`Bubbles encode simultaneous availability $D_{\text{dual}}$ in the two-dimensional $(D_\odot, D_\oplus)$ architecture decision plane.`,
        },
      ],
    },
  },

  jplVerify: {
    'high-school': {
      title: 'What is NASA JPL Horizons & how we double-check our sky angles',
      paragraph: String.raw`JPL Horizons is NASA's official solar system calculator. When we give it exact coordinates on the Moon, it returns the official compass direction (Azimuth) and height angle (Elevation) for the Sun and Earth. We compare those numbers right against our calculator so you know the positions match NASA!`,
      equations: [
        {
          label: 'Checking Angle Difference vs. NASA JPL',
          latex: String.raw`\Delta\text{El} = \text{El}_{\text{JPL}} - \text{El}_{\text{local}}, \qquad \Delta\text{Az} = \text{Shortest Compass Difference}(\text{Az}_{\text{JPL}}, \text{Az}_{\text{local}})`,
          note: String.raw`Differences are typically within a few hundredths of a degree ($< 0.05^\circ$).`,
        },
      ],
    },
    collegiate: {
      title: 'JPL Horizons DE441 topocentric comparison & circular residual math',
      paragraph: String.raw`Querying NASA JPL Horizons (` + '`CENTER=coord@301`' + String.raw`) retrieves authoritative DE441 planetary ephemerides directly for your active site. Circular azimuth wrapping ensures angles straddling $0^\circ/360^\circ$ compute clean shortest residuals.`,
      equations: [
        {
          label: 'Wrapped Azimuth & Elevation Ephemeris Residuals',
          latex: String.raw`\Delta\text{Az} = \big((\text{Az}_{\text{JPL}} - \text{Az}_{\text{local}} + 540^\circ) \bmod 360^\circ\big) - 180^\circ, \qquad \Delta\text{El} = \text{El}_{\text{JPL}} - \text{El}_{\text{local}}`,
          note: String.raw`Audits our browser VSOP87 + IAU 2015 lunar rotation matrix against JPL DE441 numerical integration.`,
        },
      ],
    },
    graduate: {
      title: 'DE441 vs. IAU 2015 analytical libration model residual analysis',
      paragraph: String.raw`Because JPL Horizons integrates full relativistic DE441 Moon/Earth ephemerides and physical librations (` + '`PA/ME`' + String.raw`), comparing live API rows against our IAU 2015 trigonometric series quantifies second-order libration and parallax residuals directly at the landing site.`,
      equations: [
        {
          label: 'Wrapped $S^1$ Bearing & Elevation Error Norms',
          latex: String.raw`\Delta\text{Az} = \big((\text{Az}_{\text{DE441}} - \text{Az}_{\text{IAU15}} + 540^\circ) \bmod 360^\circ\big) - 180^\circ, \qquad \Delta\text{El} = \text{El}_{\text{DE441}} - \text{El}_{\text{IAU15}}`,
          note: String.raw`Typically $\|\Delta\text{El}\| < 0.02^\circ$, well below the Sun's $0.53^\circ$ angular disc and sub-pixel DEM uncertainty.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'DE441 physical libration vs. Archinal IAU 2015 validation residuals',
      paragraph: String.raw`Live Horizons verification queries ` + '`QUANTITIES=4`' + String.raw` topocentric apparent Az/El on ` + '`CENTER=coord@301`' + String.raw` (DE441 inertial + PA440 physical libration frame), auditing our analytical 13-term Archinal et al. (2018) IAU 2015 ME matrix transformation in real time.`,
      equations: [
        {
          label: 'Station-Frame Angular Discrepancy Metrics',
          latex: String.raw`\Delta\text{Az} = \big((\text{Az}_{\text{DE441}} - \text{Az}_{\text{IAU15}} + 540^\circ) \bmod 360^\circ\big) - 180^\circ, \qquad \delta\psi = \sqrt{\Delta\text{El}^2 + (\Delta\text{Az}\cos\text{El})^2}`,
          note: String.raw`Spherical angular residual $\delta\psi$ captures residual DE441 free-libration / nutation terms omitted in standard 13-term IAU trigonometric polynomials.`,
        },
      ],
    },
  },

  customMask: {
    'high-school': {
      title: 'How custom $360^\circ$ mountain horizon lists are smoothly connected',
      paragraph: String.raw`Normally this app reads crater heights directly from NASA's LOLA elevation maps. If you upload your own list of compass directions and mountain angles from NASA Moon Trek, we connect the points smoothly all the way around the circle.`,
      equations: [
        {
          label: 'Connecting Neighboring Horizon Angles Smoothly',
          latex: String.raw`\theta(\text{Az}) = (1 - f)\,\theta_i + f\,\theta_{i+1}`,
          note: String.raw`Uses simple straight-line blending ($f \in [0,1)$) between each compass degree around the circle.`,
        },
      ],
    },
    collegiate: {
      title: 'Circular azimuth linear interpolation for imported horizon masks',
      paragraph: String.raw`Imported Moon Trek or LiDAR horizon profiles ($\text{Az}, \theta_{\text{mask}}$) are sampled over $1^\circ$ integer bins and linearly interpolated across the $0^\circ \leftrightarrow 360^\circ$ North seam so rays at any floating-point azimuth vary continuously.`,
      equations: [
        {
          label: 'Piecewise Circular Azimuth Interpolation',
          latex: String.raw`\theta_{\text{mask}}(\text{Az}) = (1 - f)\,\theta_{\lfloor\text{Az}\rfloor} + f\,\theta_{\lceil\text{Az}\rceil \bmod 360}, \qquad f = \text{Az} - \lfloor\text{Az}\rfloor`,
          note: String.raw`Guarantees periodic boundary continuity across North ($\text{Az}=0^\circ \equiv 360^\circ$).`,
        },
      ],
    },
    graduate: {
      title: 'Periodic $S^1$ horizon mask resampling & boulder clearance',
      paragraph: String.raw`Custom horizon CSV imports inject local surface LiDAR or Moon Trek profile exports onto the $360$-bin $S^1$ ring, superseding the regional LOLA DEM ray-march to evaluate micro-topographic boulder shadowing around lander solar wings.`,
      equations: [
        {
          label: 'Periodic Linear Interpolation on $S^1$',
          latex: String.raw`\theta_{\text{mask}}(\text{Az}) = (1 - f)\,\theta_{\lfloor\text{Az}\rfloor \bmod 360} + f\,\theta_{(\lfloor\text{Az}\rfloor + 1) \bmod 360}, \qquad f = \text{Az} - \lfloor\text{Az}\rfloor`,
          note: String.raw`Supports arbitrary sparse azimuth pairs sorted and resampled onto the continuous $360^\circ$ topocentric ring.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Local LiDAR / Moon Trek horizon override on $S^1$',
      paragraph: String.raw`Custom profile ingestion overrides the macro/meso-scale DEM tangent ray-march with local station-frame terrain elevation envelopes—essential when lander-deck hazards or sub-$5\text{ m}$ regolith hummocks tighten near-field masking beyond ` + '`SPole875_5mp`' + String.raw` resolution.`,
      equations: [
        {
          label: 'Circular Interpolant $\\theta_{\\text{mask}} : S^1 \\to \\mathbb{R}$',
          latex: String.raw`\theta_{\text{mask}}(\alpha) = (1 - f)\,\theta_{\lfloor\alpha\rfloor \bmod 360} + f\,\theta_{(\lfloor\alpha\rfloor + 1)\bmod 360}, \qquad f = \alpha - \lfloor\alpha\rfloor`,
          note: String.raw`Preserves exact $C^0(S^1)$ horizon envelope continuity for grazing solar-disc integral evaluation.`,
        },
      ],
    },
  },

  ephemTable: {
    'high-school': {
      title: 'Reading every column in the computed ephemeris table',
      paragraph: String.raw`Each row is one snapshot in UTC time. You can see where the Sun and Earth sit in compass angle (Az) and height (El), how tall the local crater wall (Mask) is in that direction, and whether Solar Power and Earth DTE radio are active.`,
      equations: [
        {
          label: 'Power & Radio Status Rule',
          latex: String.raw`\text{Active if } \;\text{Sky Elevation} - \text{Terrain Mask} \ge \text{Margin}`,
          note: String.raw`Downloading the CSV lets you graph solar energy or DTE windows in Excel or Python.`,
        },
      ],
    },
    collegiate: {
      title: 'Column guide & underlying link/power mathematical definitions',
      paragraph: String.raw`Each timestamp tabulates topocentric Sun & Earth $(\text{Az}, \text{El})$, interpolated LOLA horizon masks along those azimuths, resulting photovoltaic flux (W/m²), and operational state flags combining both constraints.`,
      equations: [
        {
          label: 'Row Clearance & Flux Equations',
          latex: String.raw`\Delta\theta_\odot = \text{El}_\odot - \theta_{\text{mask}}(\text{Az}_\odot), \qquad P_{\text{array}} = \frac{1361}{d_{\text{AU}}^2} f_{\text{disc}}(u) \cos\iota`,
          note: String.raw`All columns export cleanly in standard CSV format with site metadata headers.`,
        },
      ],
    },
    graduate: {
      title: 'Ephemeris state vectors, terrain masking & CSV export schema',
      paragraph: String.raw`Tabular records expose full topocentric ephemeris states alongside direction-specific LOLA mask evaluations and penumbral array power output for external mission-planning integration.`,
      equations: [
        {
          label: 'Exported Clearance & Flux State',
          latex: String.raw`\text{State}(t_k) = \Big(\text{Az}_\odot,\, \text{El}_\odot,\, \theta_{\text{mask}}(\text{Az}_\odot),\, P_{\text{array}},\, \text{Az}_\oplus,\, \text{El}_\oplus,\, \theta_{\text{mask}}(\text{Az}_\oplus),\, \mathbf{1}_{\text{dual}}\Big)`,
          note: String.raw`Step resolution $\Delta t$ adapts automatically from $15\text{ min}$ ($24\text{ h}$ runs) to $180\text{ min}$ ($29.5\text{ d}$ runs).`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Topocentric ephemeris telemetry & link-budget schema',
      paragraph: String.raw`Full numerical records export topocentric Apparent Solar & Earth $(\text{Az}, \text{El})$, directional $360^\circ$ spherical-chord LOLA masks, inverse-square limb-occulted array irradiance, and combined Power/DTE availability states.`,
      equations: [
        {
          label: 'Exported Telemetry Tuple',
          latex: String.raw`\mathcal{T}_k = \big(t_{\text{UTC}},\, \text{Az}_\odot,\, \text{El}_\odot,\, \theta_{\text{mask},\odot},\, P_{\text{array}},\, \text{Az}_\oplus,\, \text{El}_\oplus,\, \theta_{\text{mask},\oplus},\, \mathbf{1}_\odot \wedge \mathbf{1}_\oplus\big)`,
          note: String.raw`All angular quantities carry centi-degree numerical display precision referenced to IAU 2015 selenographic ENU.`,
        },
      ],
    },
  },

  guideSun: {
    'high-school': {
      title: 'Why $1.54^\circ$ tilt + Moon curvature create "Peaks of Eternal Light"',
      paragraph: String.raw`Because the Moon only tilts by $1.54^\circ$ (compared to Earth's big $23.4^\circ$ tilt), the Sun skims sideways near the south pole horizon all year long instead of climbing high overhead. On top of that, because the Moon is smaller ($R_{\text{Moon}} = 1737.4\text{ km}$), distant terrain drops faster down the curve, letting high mountain ridges capture sunlight $\sim 90\%$ of the year while deep crater bottoms stay frozen forever.`,
      equations: [
        {
          label: 'Moon Curvature Drop & Ridge Viewing Angle',
          latex: String.raw`\Delta h_{\text{curv}}(d) = \frac{d^2}{2 R_{\text{Moon}}}, \qquad \theta_{\text{mask}}(\alpha) = \max_{d > 0} \arctan\!\left(\frac{h_{\text{LOLA}}(d,\alpha) - h_0 - \Delta h_{\text{curv}}(d)}{d}\right)`,
          note: String.raw`At $d = 20\text{ km}$, curvature lowers distant ground by $\approx 115\text{ m}$; standing on a $+1{,}958\text{ m}$ ridge gives negative horizon angles down to $-3.6^\circ$.`,
        },
      ],
    },
    collegiate: {
      title: 'Obliquity grazing geometry & spherical terrain curvature drop',
      paragraph: String.raw`Near $90^\circ\text{S}$, the Moon's small $1.54^\circ$ spin-axis obliquity limits annual solar declination within $\pm 1.54^\circ$. Combined with the tight lunar radius $R_{\text{Moon}} = 1737.4\text{ km}$, distant massifs drop rapidly below the local tangent horizon by $d^2/(2R_{\text{Moon}})$, creating sharp illumination contrasts between high ridge crests and adjacent Permanently Shadowed Regions (PSRs).`,
      equations: [
        {
          label: 'Spherical Curvature Drop & Tangent Horizon Mask',
          latex: String.raw`\Delta h_{\text{curv}}(d) = \frac{d^2}{2 R_{\text{Moon}}}, \qquad \theta_{\text{mask}}(\alpha) = \max_{d \in [0.15,\,112]\text{ km}} \arctan\!\left(\frac{h_{\text{LOLA}}(d,\alpha) - (h_0 + h_{\text{mast}}) - \Delta h_{\text{curv}}(d)}{d}\right)`,
          note: String.raw`Because lunar curvature is $3.67\times$ sharper than Earth's, peaks past $100\text{ km}$ curve downward by nearly $2.9\text{ km}$.`,
        },
      ],
    },
    graduate: {
      title: 'Ecliptic grazing irradiance & geodesic tangent-plane horizon masking',
      paragraph: String.raw`Spin-axis locking in Cassini State 2 confines solar declination to $|\beta_\odot| \le 1.543^\circ$. Consequently, illumination persistence depends critically on whether local elevations $h_0$ exceed surrounding craters along great-circle rays after subtracting spherical horizon drop $\Delta h_{\text{curv}} = d^2/(2R_{\text{Moon}})$.`,
      equations: [
        {
          label: 'Tangent-Plane Horizon Mask on Lunar Sphere',
          latex: String.raw`\theta_{\text{mask}}(\alpha) = \max_{s > 0} \arctan\!\left(\frac{h(\exp_{p_0}(s\hat{t}_\alpha)) - (h_0+h_{\text{mast}}) - s^2/(2R_{\text{Moon}})}{s}\right), \qquad |\delta_\odot| \le 1.543^\circ`,
          note: String.raw`Connecting Ridge achieves $\theta_{\text{mask}} \in [-3.65^\circ, -0.67^\circ]$ on LOLA $5\text{ m/px}$ crest grids, yielding $\sim 90\%$ annual insolation.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Cassini-State grazing obliquity & multi-tier LOLA horizon integral',
      paragraph: String.raw`The Moon's $1.543^\circ$ ecliptic obliquity confines polar insolation to grazing chord angles where $280\text{ m}$/pixel DEMs underestimate narrow ridge elevation and overpredict masking inside neighboring crater walls. Querying $5\text{ m/px}$ LOLA crest rasters with exact curvature-compensated geodesic steps recovers true sub-zero ridge masks.`,
      equations: [
        {
          label: 'Geodesic Horizon Mask & Solar Declination Envelope',
          latex: String.raw`\theta_{\text{mask}}(\alpha) = \sup_{s} \arctan\!\left(\frac{h_{\text{DEM}}(\psi,\alpha) - (h_0 + h_{\text{mast}}) - R_m(1-\cos\psi)}{R_m\sin\psi}\right) \approx \sup_s \arctan\!\left(\frac{\Delta h - \frac{s^2}{2R_m}}{s}\right)`,
          note: String.raw`Small-angle expansion $R_m(1-\cos\psi) \approx s^2/(2R_m)$ agrees to $< 0.01\text{ m}$ over $112\text{ km}$ ($\psi \le 3.7^\circ$).`,
        },
      ],
    },
  },

  guideEarth: {
    'high-school': {
      title: 'Why Earth wobbles in a loop while staying toward North ($0^\circ$)',
      paragraph: String.raw`Even though the same side of the Moon always faces Earth, the Moon's tilted ($5.14^\circ$) oval orbit makes Earth slowly nod up and down by $\pm 6.7^\circ$ and side-to-side by $\pm 7.9^\circ$ every month. If you land at $89^\circ\text{S}$, Earth hovers right above the northern horizon—so Earth rises above near-side hills for two weeks and sets behind them for two weeks unless you land on a high near-side peak!`,
      equations: [
        {
          label: 'Rough Height of Earth in the South Pole Sky',
          latex: String.raw`\text{Earth Elevation} \approx (90^\circ + \text{Latitude}) \pm 6.7^\circ, \qquad \text{OWLT Delay} = \frac{d_{\text{Earth}}}{c} \approx 1.28\text{ s}`,
          note: String.raw`At $-85.5^\circ$ (like Mons Mouton), $90^\circ + (-85.5^\circ) = +4.5^\circ$, keeping Earth higher above crater walls than right at $-89.5^\circ$ ($+0.5^\circ$).`,
        },
      ],
    },
    collegiate: {
      title: 'Optical/physical libration & IAU 2015 Sun–Earth coupling equations',
      paragraph: String.raw`Converting J2000 inertial vectors to the lunar Mean-Earth/Polar-Axis frame maps both Sun and Earth into the exact same horizon geometry. While the Sun rotates $360^\circ$ in azimuth, orbital inclination ($5.14^\circ$) and eccentricity ($0.055$) drive Earth's monthly figure-eight optical libration near $\text{Az} = 0^\circ\text{ N}$.`,
      equations: [
        {
          label: 'IAU 2015 Body-Fixed to Local East-North-Up Transform',
          latex: String.raw`\vec{\Delta r}_{\text{BF}} = \mathbf{R}_{\text{BF}}(\alpha_0, \delta_0, W)\,\vec{r}_{\text{Moon}\to\text{Body}} - \vec{r}_{\text{obs}}(\phi, \lambda), \qquad \text{El} = \arcsin\!\left(\frac{U}{\|\vec{\Delta r}\|}\right)`,
          note: String.raw`At latitude $\phi$, Earth's mean northern height is $90^\circ+\phi$ modulated by $\pm 6.7^\circ$ libration, with radio delay $\tau_{\text{OWLT}} = \|\vec{\Delta r}_\oplus\|/c$.`,
        },
      ],
    },
    graduate: {
      title: 'Euler-angle ME transformation & libration-latitude trade-off',
      paragraph: String.raw`Selenographic Earth visibility obeys a deterministic trade with landing colatitude $\chi = 90^\circ + \phi$: moving equatorward to $\phi \approx -85.5^\circ$ on the near-side prime meridian lifts Earth center by $+4.5^\circ$, keeping the $\pm 6.7^\circ$ libration cycle predominantly clear of local ridges for $>90\%$ DTE availability.`,
      equations: [
        {
          label: 'Topocentric Spherical Visibility & Libration Excursion',
          latex: String.raw`\mathbf{R}_{\text{BF}} = R_z(W)R_x\!\left(\tfrac{\pi}{2}-\delta_0\right)R_z\!\left(\tfrac{\pi}{2}+\alpha_0\right), \qquad \Delta\theta_{\text{DTE}} = \text{El}_\oplus(\phi,\lambda,t) - \theta_{\text{mask}}\big(\text{Az}_\oplus(t)\big)`,
          note: String.raw`Coupled ephemeris evaluation evaluates Earth parallax ($R_\oplus / d_\oplus \approx 0.95^\circ$) and instantaneous northern mountain clearance simultaneously.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Archinal IAU 2015 rotation kinematics & DTE libration closure',
      paragraph: String.raw`The transformation from ICRF/EQJ to the selenocentric Mean-Earth frame incorporates right ascension $\alpha_0(t)$, declination $\delta_0(t)$, prime-meridian rotation $W(t)$, and periodic libration arguments $E_1\dots E_{13}$. Near-side massifs near $0^\circ\text{ E}$ maximize Earth elevation gain $(90^\circ+\phi)$ against local foreground masks.`,
      equations: [
        {
          label: 'IAU 2015 Kinematic Chain & Sub-Earth Libration Geometry',
          latex: String.raw`\vec{\Delta r}_{\text{ENU}} = \mathbf{Q}_{\text{ENU}}(\phi,\lambda)\Big[\mathbf{R}_z(W)\mathbf{R}_x\!\left(\tfrac{\pi}{2}-\delta_0\right)\mathbf{R}_z\!\left(\tfrac{\pi}{2}+\alpha_0\right)\vec{r}_{\text{EQJ}} - \vec{r}_{\text{obs}}\Big], \quad \tau_{\text{OWLT}} = \frac{\|\vec{\Delta r}_\oplus\|}{c}`,
          note: String.raw`Synchronized Sun and Earth ENU transformations guarantee self-consistent simultaneous Sun + DTE link budgets.`,
        },
      ],
    },
  },

  guideArray: {
    'high-school': {
      title: 'Why vertical solar towers beat flat rooftop panels at the poles',
      paragraph: String.raw`When the Sun hovers only $1^\circ$ or $2^\circ$ above the horizon, sunlight skims across a flat ground panel at a tiny angle, losing over $95\%$ of its energy. Standing solar panels upright on a rotating mast lets them face the low Sun head-on to capture nearly the full $1{,}361\text{ W/m}^2$ available in space, while lifting panels above nearby rocks!`,
      equations: [
        {
          label: 'Flat vs. Vertical Solar Panel Power',
          latex: String.raw`P_{\text{flat}} \approx 1361 \cdot \sin(\text{Sun Elev}), \qquad P_{\text{vertical-tracking}} \approx 1361 \cdot (\text{Visible Sun Fraction})`,
          note: String.raw`At $\text{Sun Elev} = 2^\circ$, $\sin(2^\circ) \approx 0.035$ ($48\text{ W/m}^2$ flat vs. $1361\text{ W/m}^2$ vertical—a $28\times$ gain!).`,
        },
      ],
    },
    collegiate: {
      title: 'Solar disc partial-eclipse & incidence cosine power equations',
      paragraph: String.raw`Grazing illumination creates partial penumbral eclipses across the Sun's $0.53^\circ$ angular disc while punishing flat horizontal collectors by $\sin\text{El}_\odot$. Raising mast height $h_{\text{mast}}$ increases geometric depression to nearby foreground boulders via $\Delta\theta \approx \Delta h / d$.`,
      equations: [
        {
          label: 'Solar Disc Occultation Fraction & Array Output',
          latex: String.raw`f_{\text{disc}}(u) = 1 - \frac{\arccos(u) - u\sqrt{1 - u^2}}{\pi}, \qquad P_{\text{array}} = \frac{1361}{d_{\text{AU}}^2}\,f_{\text{disc}}(u)\cdot\begin{cases}1 & \text{tracking}\\ \max(0, \sin\text{El}_\odot) & \text{horizontal}\end{cases}`,
          note: String.raw`Here $u = \operatorname{clamp}\big((\text{El}_\odot - \theta_{\text{mask}})/\rho_\odot, -1, 1\big)$ integrates the unoccluded circular segment of the solar photosphere.`,
        },
      ],
    },
    graduate: {
      title: 'Photospheric circular-segment quadrature & mast horizon gain',
      paragraph: String.raw`Grazing terrain occultation over the $0.266^\circ$ solar angular radius is resolved analytically by circular-segment area quadrature without limb darkening, coupled with mast-elevation sensitivity $\partial\theta_{\text{mask}}/\partial h_{\text{mast}} \approx -d^{-1}$.`,
      equations: [
        {
          label: 'Analytic Limb-Occultation Integrand & Mast Gain',
          latex: String.raw`f_{\text{disc}}(u) = \frac{1}{\pi}\left(\pi - \cos^{-1}u + u\sqrt{1-u^2}\right), \qquad \Delta\theta_{\text{mast}}(d) \approx -\frac{\Delta h_{\text{mast}}}{d}`,
          note: String.raw`Raising a $10\text{ m}$ mast clears nearby $200\text{ m}$ ridge obstacles by nearly $2.9^\circ$, substantially enlarging continuous power runs.`,
        },
      ],
    },
    'nasa-professor': {
      title: 'Grazing photovoltaic fluence, disc-chord occultation & mast sensitivity',
      paragraph: String.raw`Low-elevation polar PV architecture mandates single-axis azimuth-tracking vertical arrays ($\cos\iota \approx 1$) rather than planar zenith-normal panels ($\cos\iota = \sin\text{El}_\odot$). Analytical chord integration smoothly models penumbral ramp transients as the solar disc traverses serrated LOLA crater silhouettes.`,
      equations: [
        {
          label: 'Photospheric Chord Integrator & Mast Jacobian',
          latex: String.raw`f_{\text{disc}}(u) = \frac{2}{\pi}\int_{-1}^{u}\sqrt{1-t^2}\,dt = 1 - \frac{\cos^{-1}u - u\sqrt{1-u^2}}{\pi}, \qquad \frac{\partial\theta_{\text{mask}}}{\partial h_{\text{mast}}} = \frac{-d}{d^2 + \Delta h_{\text{eff}}^2}`,
          note: String.raw`Combined with heliocentric eccentricity scaling $r_{\odot\text{AU}}^{-2} \in [0.967, 1.034]$ across the orbital year.`,
        },
      ],
    },
  },
};
