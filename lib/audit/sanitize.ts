export function redactSensitive(value: string, max = 240): string {
  return value
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[card redacted]")
    .replace(/\b\d{10,}\b/g, "[number redacted]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email redacted]")
    .slice(0, max);
}

export function cleanText(value: string | undefined, max = 160): string {
  if (!value) return "";
  return redactSensitive(value.trim(), max);
}
