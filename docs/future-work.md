# Future work

Cleanup candidates that were identified during the `src/{client,server,data}` refactor.
Nothing here is urgent — the app is stable and all checks pass. Each item can be picked
up case by case.

## Tooling

- The Vite chunk-size warning (669 kB) comes from bundling Three.js. Not a problem
  for this app; code splitting would only help if a second entry point is added.

## Rendering / data

- **Move street lamps (`light_*`) into the decoration layer (server-computed).** Today `createRoadsideLampPlacements` runs in the client from `createRoadCenterPath` + roundabout centers (see `src/client/streetLamps.ts`, used in `src/client/main.ts`). Migrating means computing placements server-side (same road/center logic, careful to avoid duplicating routing code badly) and emitting them as decorations (e.g. `name: 'light_curved'`, etc.) so the client only renders; note this requires access to road center geometry/roundabout positions on the server or a shared helper. Also revisit the “no lamps inside roundabout area / outward-only” rules in tests if behavior changes.

## Details

- The `construction_light` model's light should blink, and be less bright

## Deployment

- Deploy the app on Vercel or similar "free" platform
