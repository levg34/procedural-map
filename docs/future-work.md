# Future work

Cleanup candidates that were identified during the `src/{client,server,data}` refactor.
Nothing here is urgent — the app is stable and all checks pass. Each item can be picked
up case by case.

## Client

### Extract the camera rig from `main.ts`

`src/client/main.ts` still owns camera behavior: OrbitControls + FlyControls setup,
the follow/free mode toggle (`C` key), the `cameraHint` DOM element, and the
per-frame `flyMovement` bookkeeping that keeps the orbit target in sync with the
fly camera. These are scattered across initialization, `animate()`, and the
`keydown` listener.

A `src/client/cameraRig.ts` module could expose something like:

```ts
createCameraRig({ scene, domElement, cameraHint })
  .follow(ambulancePosition)
  .toggleMode()
  .update(deltaTime, ambulancePosition)
```

That would remove camera state from `main.ts` and make it directly testable.

### Road-preview controller

`models` in `main.ts` mixes the loaded road catalog with preview state (`index`,
`current`), and `loadRoadPreview()` recurses to wrap around. A small
`roadPreview.ts` controller would keep the catalog immutable and make wraparound
explicit.

### Model variety on respawn

`respawnVehicle()` now reuses the same vehicle object so the scene's light counts
stay constant — changing them invalidates every shader program and freezes the
page. The cost is that each lane keeps its startup model.

A safe way to restore variety later is to swap only the visual GLB clone between
models with the **same light signature** (same number of visible point lights and
spotlights), leaving the light objects untouched. Most traffic models share the
same signature (2 spotlights, no beacons); `police` and `ambulance`/`firetruck`
are separate groups, as are `race`/`raceFuture`. Group models by `(point, spot)`
counts, pick replacements from the same group, and apply the weights from
`trafficVehicleWeights` within each group. Never use `visible = false` for
unused lights — that removes them from the renderer's count and reintroduces the
freeze; use `intensity = 0` instead.

### Time-based beacon blinking

`trafficSimulation.ts` still blinks beacons on a frame counter, so the blink rate
changes with FPS. Replacing `blinkCounter` with a time accumulator (e.g.
`blinkElapsed += deltaTime`) would make it predictable. This was deliberately left
as-is during extraction to preserve existing behavior.

### Vehicle pose constants

`VEHICLE_SCALE = 0.2`, the `0.02` Y lift, and the `-0.75` GLB Z offset are
repeated in `main.ts` and `trafficSimulation.ts`. Promoting them to shared
constants in `src/data/` or a small `src/client/vehicleConstants.ts` would remove
the duplication.

### Roundabout path module

`src/client/vehiclePath.ts` has a self-contained ~70-line `createRoundaboutPath()`
builder. It could move to its own `roundaboutPath.ts` module so `vehiclePath.ts`
focuses on lane positioning.

## Server

### De-duplicate Express error handling

`src/server/index.ts` repeats the same `try/catch → 500 JSON` block five times.
An `asyncRoute()` wrapper would compress it:

```ts
const asyncRoute = (handler: RequestHandler): RequestHandler => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next)
```

...plus a shared error-handling middleware. This also makes error responses
consistent.

## Tooling

- Consider `isolate: false` in the Vitest config — the test runner reports ~800 ms
  saved per run by reusing workers, and the current suite has no cross-test state.
- The Vite chunk-size warning (669 kB) comes from bundling Three.js. Not a problem
  for this app; code splitting would only help if a second entry point is added.
