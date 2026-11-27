# Future work

Cleanup candidates that were identified during the `src/{client,server,data}` refactor.
Nothing here is urgent — the app is stable and all checks pass. Each item can be picked
up case by case.

## Tooling

- The Vite chunk-size warning (669 kB) comes from bundling Three.js. Not a problem
  for this app; code splitting would only help if a second entry point is added.
