# Future work

## Tooling

- The Vite chunk-size warning (669 kB) comes from bundling Three.js. Not a problem
  for this app; code splitting would only help if a second entry point is added.

## Rendering / data

- **Move street lamps (`light_*`) into the decoration layer (server-computed).** Today `createRoadsideLampPlacements` runs in the client from `createRoadCenterPath` + roundabout centers (see `src/client/streetLamps.ts`, used in `src/client/main.ts`). Migrating means computing placements server-side (same road/center logic, careful to avoid duplicating routing code badly) and emitting them as decorations (e.g. `name: 'light_curved'`, etc.) so the client only renders; note this requires access to road center geometry/roundabout positions on the server or a shared helper. Also revisit the “no lamps inside roundabout area / outward-only” rules in tests if behavior changes.

## Details

- The `construction_light` model's light should blink, and be less bright

## Traffic

- **Reconfigure lights in place when swapping vehicle visuals.** `respawnVehicle` in `src/client/trafficSimulation.ts` currently replaces only the GLB clone, so beacon/spotlight positions and colors stay from the model the vehicle started with, and `enableHeadlightGlow` / `enableTailLightGlow` are never applied to a replacement's materials. We avoid mismatches today by only swapping models with an identical full light config (`getLightConfigKey`). A future improvement could keep the same light objects (preserving Three.js's shader cache key) but copy the replacement's beacon positions/colors and headlight placement onto them, and enable glow on the replacement visual's materials. The number of visible lights must still stay constant.

## Deployment

- Deploy the app on Vercel or similar "free" platform
