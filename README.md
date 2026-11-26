# procedural-map

Generate and view a procedural 3D road map with Three.js.

## Run locally

Requires Node.js 22.12 or newer. Install dependencies and start the dev servers:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173` for a generated road or
`http://localhost:5173/showcase` for the debugging showcase. Vite serves the
browser app and proxies API/model requests to Express on port 3210. The main
page requests an 8×8-or-larger grid from `GET /road/:size`; press **Space** to
preview road models.

For a production build and server, run `npm start` and open
`http://localhost:3210` or `http://localhost:3210/showcase`.

## Checks

```sh
npm test             # Type-check and run Vitest
npm run format:check # Check formatting with Prettier
npm run build        # Type-check and create the production client bundle
```

## Code map

- `index.ts` — Express API and production static-file server.
- `roadGrid.ts` — grid network generator: closes every connector, uses every connectable road type, and derives vehicle routes.
- `classes.ts`, `roadData.ts`, `utils.ts` — connection primitives, directions, and model metadata.
- `src/main.ts`, `src/data.ts`, `src/vehiclePath.ts` — Three.js scene, API types, and vehicle routes.
- `test/` — road-generation and network tests.

## Road generation

`GET /road/:size` (or `Road.build`/`buildRoadNetwork` in TypeScript) takes a
single integer grid size and builds a connected road network inside that area.
Generation has three rules:

1. Every connector of every placed tile is paired with a facing connector on a
   neighbor — no dangling ends.
2. Every connectable road type in `roadData.ts` is used at least once; after
   that, placements prefer unused types and layouts that close multiple ports.
3. A placement is accepted only if every remaining open port can still be
   extended, which prevents connectors from becoming trapped.

The response is a graph: `tiles` (positions/rotations/ports), `connections`
(paired ports and their world points), and `routes` (linear tile sequences
derived from the graph for the vehicle splines). The old linear `Road.build`
path and `/road/showcase` are kept for debugging.

## Browser debugging helpers

The browser renderer is in `src/main.ts`. Optional Three.js helpers and light-position controls can be added there when debugging; they are not enabled by default.

To enable the grid and axes, add this after creating `scene`:

```ts
scene.add(new THREE.GridHelper(10, 10))
scene.add(new THREE.AxesHelper(5))
```

To tune the ambulance lights interactively, install [lil-gui](https://www.npmjs.com/package/lil-gui) as a development dependency:

```sh
npm install --save-dev lil-gui
```

Import `GUI` at the top of `src/main.ts`, then add the controls inside `initializeAmbulance()`, after creating `headLight` and `headLight2`:

```ts
import { GUI } from 'lil-gui'

const gui = new GUI()
const lights = gui.addFolder('Ambulance lights')
if (!headLight || !headLight2) throw new Error('Ambulance lights have not been created')
lights.add(headLight.position, 'x', -2, 2, 0.05).name('Left X')
lights.add(headLight.position, 'y', -2, 2, 0.05).name('Left Y')
lights.add(headLight.position, 'z', -2, 2, 0.05).name('Left Z')
lights.add(headLight2.position, 'x', -2, 2, 0.05).name('Right X')
lights.add(headLight2.position, 'y', -2, 2, 0.05).name('Right Y')
lights.add(headLight2.position, 'z', -2, 2, 0.05).name('Right Z')
```

To visualize a point light's position, create its helper after the light and add it to the scene:

```ts
const helper = new THREE.PointLightHelper(headLight, 0.1)
scene.add(helper)
```

The helper is created from the light's current position. If you move a light, call `helper.update()` after changing its position so the helper follows it.

The GLTF loader also reports download progress to the browser console. Its loaded result includes animations, scenes, cameras, and asset metadata if those need inspection.
