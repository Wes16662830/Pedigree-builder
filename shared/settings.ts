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

// Loft branding — used in the sheet header instead of a hardcoded name/logo
// (see src/components/PedigreeSheet.tsx). All optional; the app falls back
// to the original OudeLuck placeholder values when unset.
export const LOFT_NAME_SETTING = 'loft_name';
export const LOFT_SUBTITLE_SETTING = 'loft_subtitle';
export const LOFT_ADDRESS_SETTING = 'loft_address';
export const LOFT_PHONE_SETTING = 'loft_phone';
export const LOFT_EMAIL_SETTING = 'loft_email';
// A data: URL — small enough (see the 500KB client-side cap) to store as a
// plain settings row rather than a separate upload/R2 object.
export const LOFT_LOGO_SETTING = 'loft_logo_data_url';
// A multiplier on each template's own base logo size (see logoSizeFor in
// PedigreeSheet.tsx) — stored as text like every other settings row, parsed
// back to a number on read. "1" (unset) means the original size.
export const LOFT_LOGO_SCALE_SETTING = 'loft_logo_scale';

export interface LoftSettings {
  name?: string;
  subtitle?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoDataUrl?: string;
  logoScale?: string;
}
