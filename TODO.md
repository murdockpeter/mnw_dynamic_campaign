# Persistence TODO

This is the agreed line in the sand for the first persistence milestone.

Do not expand scope beyond these items until all are implemented and tested working properly.

## Milestone

1. Build the core state schema.
2. Add JSON storage.
3. Add a normalized mission result format.
4. Add a tiny runtime that loads enabled modules.
5. Implement two first modules:
   - `damage`
   - `ammo`
6. Add a simple next-mission generator hook.
7. Test the full loop end to end.

## Design Rules

- Persistence lives outside MNW.
- Persistence systems must be modular and selectable by configuration.
- The core runtime must not hardcode one campaign system.
- Modules mutate shared state and contribute generation directives.
- Mission/package writing remains a separate concern from persistence logic.

## Status

- [x] 1. Core state schema
- [x] 2. JSON storage
- [x] 3. Normalized mission result format
- [x] 4. Tiny runtime with module loading
- [x] 5. First modules: `damage`, `ammo`
- [x] 6. Simple next-mission generator hook
- [x] 7. Test the full loop end to end

## Notes

- Smoke test passed via `python -m unittest tests.test_persistence_smoke`.
- The current implementation is a scaffold for pluggable persistence systems, not a final gameplay ruleset.
