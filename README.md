# procedural-map

Generate and view a procedural 3D road map with Three.js.

## Run locally

Requires Node.js 22.12 or newer. Install dependencies and start the dev servers:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite serves the browser app and proxies API/model requests to Express on port 3210. Press **Space** to preview road models.

For a production build and server, run `npm start` and open `http://localhost:3210`.

## Checks

```sh
npm test             # Type-check and run Vitest
npm run format:check # Check formatting with Prettier
npm run build        # Type-check and create the production client bundle
```

## Code map

- `index.ts` — Express API and production static-file server.
- `classes.ts`, `roadData.ts`, `utils.ts` — road generation, connection directions, and model metadata.
- `src/main.ts`, `src/data.ts` — Three.js scene and browser API calls.
- `test/` — road-generation tests.

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

Import `GUI` at the top of `src/main.ts`, then add the controls inside the ambulance model's `.then()` callback, after creating `headLight` and `headLight2`:

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
