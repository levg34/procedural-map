# Shared data

Static configuration and types derived from the GLB models and the generated road wire format. These modules are imported by both `src/client/` and `src/server/`, so they must stay runtime-neutral: no Node builtins, Express, or DOM globals here.
