const USERNAME_RE = /^[a-z](?:[a-z0-9_]{3,30})[a-z0-9]$/i

/** Normalizes a Telegram @username to lowercase, stripping an optional leading "@". */
export function normalizeTelegramUsername(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase()
}

/** Telegram usernames are 5-32 chars, start with a letter, and use only letters/digits/underscores. */
export function isValidTelegramUsername(username: string): boolean {
  return USERNAME_RE.test(username)
}
