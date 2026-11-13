const restrictedDestinations = [
  {
    code: "KR",
    names: ["south korea", "republic of korea", "korea republic of", "korea south", "korea"],
  },
  {
    code: "BR",
    names: ["brazil", "brasil", "federative republic of brazil", "republica federativa do brasil"],
  },
] as const;

function normalizeCountryName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\\s+/g, " ");
}

export function isRestrictedShippingDestination(countryCode: unknown, countryName: unknown) {
  const code = typeof countryCode === "string" ? countryCode.trim().toUpperCase() : "";
  const name = normalizeCountryName(typeof countryName === "string" ? countryName : "");

  return restrictedDestinations.some(
    (destination) => code === destination.code || destination.names.some((alias) => name === alias),
  );
}
