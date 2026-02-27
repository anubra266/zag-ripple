export function isTracked(value: any): boolean {
  return value != null && typeof value === "object" && "__v" in value && typeof value.f === "number"
}
