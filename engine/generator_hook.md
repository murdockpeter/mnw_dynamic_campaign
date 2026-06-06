# Generator Hook

The persistence runtime does not write `.mis` or `.cmp` files directly.

It produces a `GenerationPlan` made of directives such as:

- `override_unit_ammo`
- `adjust_unit_damage`
- `exclude_unit`

The next mission generator is expected to:

1. load current campaign state
2. build a `GenerationContext`
3. ask the runtime for a `GenerationPlan`
4. apply the plan to a mission template or scenario writer
5. rebuild the `.kyt`

This keeps persistence systems modular and decoupled from MNW package-writing logic.
