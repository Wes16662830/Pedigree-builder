// Shared constants/helpers for the generic key/value `settings` table.
// Currently only used for the Anthropic API key entered on the Settings
// page — see server/lib/anthropic.ts and worker/lib/anthropic.ts for how
// it's resolved (settings table first, then the deploy's env var/secret as
// a fallback).

export const ANTHROPIC_API_KEY_SETTING = 'anthropic_api_key';

/** "sk-ant-api03-...vXyz" — never return the full key to the client. */
export function maskApiKey(key: string): string {
  if (key.length <= 10) return '••••';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}
