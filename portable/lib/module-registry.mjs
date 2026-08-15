export const MODULE_REGISTRY = Object.freeze({
  damage: Object.freeze({
    id: "damage",
    label: "Damage & Repair",
    description: "Persists unit damage and restores readiness as campaign time advances.",
    config: Object.freeze({
      repair_rate_per_day: Object.freeze({
        type: "number",
        label: "Repair rate per day",
        default: 0.08,
        min: 0,
        max: 1,
        step: 0.01
      })
    })
  }),
  ammo: Object.freeze({
    id: "ammo",
    label: "Ammunition",
    description: "Persists weapon expenditure between missions.",
    config: Object.freeze({
      allow_negative: Object.freeze({
        type: "boolean",
        label: "Allow negative ammunition",
        default: false
      })
    })
  })
});

export function listModules() {
  return Object.values(MODULE_REGISTRY).map((module) => ({
    ...module,
    config: Object.fromEntries(Object.entries(module.config).map(([key, field]) => [key, { ...field }]))
  }));
}

export function normalizeModulesConfig(input = {}) {
  const requested = Array.isArray(input.enabled_modules) ? input.enabled_modules : Object.keys(MODULE_REGISTRY);
  const enabledModules = [...new Set(requested)].filter((id) => MODULE_REGISTRY[id]);
  const moduleConfig = {};

  for (const [moduleId, definition] of Object.entries(MODULE_REGISTRY)) {
    moduleConfig[moduleId] = {};
    for (const [key, field] of Object.entries(definition.config)) {
      const raw = input.module_config?.[moduleId]?.[key];
      if (field.type === "boolean") {
        moduleConfig[moduleId][key] = raw == null ? field.default : Boolean(raw);
      } else {
        const numeric = Number(raw ?? field.default);
        moduleConfig[moduleId][key] = Math.max(field.min, Math.min(field.max, Number.isFinite(numeric) ? numeric : field.default));
      }
    }
  }

  return { enabled_modules: enabledModules, module_config: moduleConfig };
}

export function validateModulesConfig(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ["Module configuration must be an object."];
  }
  if (!Array.isArray(input.enabled_modules)) {
    errors.push("enabled_modules must be an array.");
  } else {
    for (const id of input.enabled_modules) {
      if (!MODULE_REGISTRY[id]) errors.push(`Unknown module: ${id}.`);
    }
  }
  return errors;
}
