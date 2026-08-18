const E164_RE = /^\+[1-9]\d{7,14}$/

/** Normalizes a phone number to E.164 (e.g. "+51987654321"), assuming a "+" prefix when missing. */
export function normalizePhone(input: string): string {
  const digits = input.trim().replace(/[\s\-()]/g, '')
  return digits.startsWith('+') ? digits : `+${digits}`
}

export function isValidPhone(phone: string): boolean {
  return E164_RE.test(phone)
}
