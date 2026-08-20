// Ring number handling. See build brief §7 "Known issues to carry over":
// ring format is inconsistent between lofts (some write ring-then-year, some
// year-then-ring). We never guess which is "correct" — we store the verbatim
// ring exactly as read, and separately store a normalised form used only for
// matching birds across uploads. The normalised form's field order is a
// setting, not a hardcoded assumption.

export type RingFieldOrder = 'ring-year' | 'year-ring';

export interface RingSettings {
  fieldOrder: RingFieldOrder;
}

export const DEFAULT_RING_SETTINGS: RingSettings = {
  // Wes's own convention: "ZA 2805 BORD 2026" (ring, then year)
  fieldOrder: 'ring-year',
};

/**
 * Parse a verbatim ring string into parts. Rings are loosely
 * "COUNTRY [YEAR] CLUBCODE NUMBER" but the token order varies by loft, so we
 * only extract what we can identify with confidence:
 *  - country: leading letters (2-4 chars)
 *  - year: a standalone 2-digit or 4-digit number token
 *  - the remaining tokens, in original order, joined as the "rest"
 * This is intentionally conservative — it's a matching aid, not a parser to
 * be trusted blindly.
 */
export function parseRingTokens(ring: string): { country?: string; year?: string; rest: string[] } {
  const tokens = ring
    .trim()
    .toUpperCase()
    .split(/[\s/-]+/)
    .filter(Boolean);
  if (tokens.length === 0) return { rest: [] };

  let country: string | undefined;
  let year: string | undefined;
  const rest: string[] = [];

  for (const [i, tok] of tokens.entries()) {
    if (i === 0 && /^[A-Z]{2,4}$/.test(tok)) {
      country = tok;
      continue;
    }
    if (!year && /^\d{2}$/.test(tok)) {
      year = normaliseTwoDigitYear(tok);
      continue;
    }
    if (!year && /^\d{4}$/.test(tok) && Number(tok) > 1900 && Number(tok) < 2100) {
      year = tok;
      continue;
    }
    rest.push(tok);
  }
  return { country, year, rest };
}

function normaliseTwoDigitYear(yy: string): string {
  const n = Number(yy);
  // Pigeon ring years are always in the last ~40 years; treat 2-digit years
  // as 20xx. Adjust the pivot if this tool is still in use after 2099.
  return `20${String(n).padStart(2, '0')}`;
}

/**
 * Produce a normalised, order-independent matching key for a ring, e.g.
 * "ZA-2021-BPFD-845". Two verbatim rings that describe the same physical
 * ring but were transcribed in a different field order will normalise to
 * the same key, which is what makes cross-loft matching (Phase 5) possible.
 * The verbatim `ring` field is never overwritten by this.
 */
export function normaliseRing(ring: string, _settings: RingSettings = DEFAULT_RING_SETTINGS): string {
  const { country, year, rest } = parseRingTokens(ring);
  const parts = [country, year, ...rest].filter(Boolean);
  return parts.join('-');
}

/** Render a normalised ring back into a display string honouring a field-order setting. */
export function formatRing(country: string | undefined, year: string | undefined, rest: string[], settings: RingSettings): string {
  const numberPart = rest.join(' ');
  if (settings.fieldOrder === 'ring-year') {
    return [country, numberPart, year].filter(Boolean).join(' ');
  }
  return [country, year, numberPart].filter(Boolean).join(' ');
}
