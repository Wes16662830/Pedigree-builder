// Extraction and prose-generation prompts. These encode the rules in build
// brief §5 word-for-word where possible — they are the actual product, not
// boilerplate, so change them deliberately and re-test against all five
// source formats in §1 before shipping a change.

export const EXTRACTION_SYSTEM_PROMPT = `You are extracting structured data from a racing pigeon pedigree document for OudeLuck Lofts. The source may be from any loft, in any layout, in any language (English, German, Dutch, Czech, or others), and may be a scan, photo, or PDF. There is no consistent schema across sources — read what is actually on the page.

Return the full ancestor tree shown on the document, to whatever depth it goes (typically 4–5 generations). The document's subject bird (the one the pedigree is "for") is generation 0; its parents are generation 1; grandparents generation 2; and so on.

Hard rules — these matter more than completeness:

1. VERBATIM TEXT. Copy ring numbers, names, and prose notes exactly as printed — same characters, same punctuation, same order. Put this in \`ring\`, \`name\`, and \`notes\`. Never normalise, reformat, or "clean up" a ring number.

2. TRANSLATION IS SEPARATE. If notes are not in English, put an English translation in \`notesEn\`, in the same order as \`notes\`, one-to-one. Never translate in place — \`notes\` always stays verbatim source language. If the source is already English, leave \`notesEn\` empty.

3. SEX. Set \`sex\` to "cock" or "hen" only when the document states it outright for THAT bird (e.g. an explicit label, or a sex symbol directly attached to that bird's own box). Do NOT infer a bird's sex from a V/W or male/female marker printed on an ANCESTOR's box — that marker describes the ancestor, not the pedigree's subject. When in doubt, use "unknown". This exact mistake — inferring the subject's sex from an ancestor's marker — has caused real errors before; do not repeat it.

4. NEVER INVENT. A ring number, race placing, pool size, or any other field that is missing, illegible, or not shown on the source MUST be left out (null / omitted) — never guessed, never filled from a pattern, never estimated. An empty box in the source pedigree (an ancestor with no recorded ring) simply does not appear in your \`birds\` list — do not fabricate a placeholder ancestor to fill a generation slot. If a ring is present but you cannot read it with confidence, transcribe your best reading and lower \`confidence\` — do not write "[illegible]" as if it were the ring.

5. RESULTS. Each race result line becomes one entry in \`results\`, with \`raw\` holding the exact source text for that line. Break out \`race\`, \`distanceKm\`, \`year\`, \`position\`, \`poolSize\`, \`federation\` only when you can read them directly — leave any you can't read as null. Do not compute or infer a pool size or position from other numbers.

6. LOFT-LEVEL VS BIRD-LEVEL. If a note describes the loft or breeder generally (championship titles, loft history) rather than the specific bird in that box, still record it verbatim in that bird's \`notes\` — but do not attach it as if it were the bird's own race result. It belongs in prose narrative, not in \`results\`.

7. CONFIDENCE. Give every bird a \`confidence\` from 0 to 1 reflecting how sure you are of what you transcribed for it. Use low confidence (well under 0.85) for anything handwritten, cropped, blurry, low-resolution, or ambiguous. A clean, clearly printed box in a high-quality scan should be high confidence.

Structure: return a flat list of birds. Each bird gets a short \`localId\` you choose (e.g. "b0", "b1", ...) and, where shown, \`sireRef\`/\`damRef\` pointing at the \`localId\` of its sire/dam elsewhere in your own list. Set \`rootLocalId\` to the localId of generation 0. Use \`extractionNotes\` for any caveats about the scan itself (illegible regions, cropped edges, uncertain sections) — this is about the document, not any one bird.`;

export function extractionUserPrompt(filenameHint: string): string {
  return `Extract the full pedigree from the attached document (source file: "${filenameHint}"). Follow every rule in the system prompt exactly, especially: never infer a bird's sex from an ancestor's V/W marker, never invent a missing ring/result, and keep notes verbatim with translation in a separate field.`;
}

export const RESULTS_EXTRACTION_SYSTEM_PROMPT = `You are extracting a race results table for one racing pigeon from a results extract for OudeLuck Lofts — typically a screenshot from a oneloft race results site, a federation results page, or similar. Layouts vary (columns in different orders, different units, different languages) — read what is actually on the page rather than assuming a fixed layout.

Return one entry in \`results\` per race row shown, in the order they appear on the page.

Hard rules — these matter more than completeness:

1. RAW IS ALWAYS FULL. \`raw\` must capture the complete row verbatim as text — race name, distance, date, arrival time, time difference, average speed, position, and anything else printed on that row — even fields that don't have their own structured column below. Never drop information into \`raw\` that you also could have, but didn't, put in a structured field.

2. STRUCTURED FIELDS ONLY WHEN CLEARLY READABLE. Break out \`race\` (the race name), \`distanceKm\` (numeric distance in km — convert from the row if it's shown as e.g. "220 km", but never guess a unit that isn't stated), \`year\` (from the date shown, if any), \`position\` (finishing position/rank), \`poolSize\` (total birds in that race, if shown — this table format typically does NOT show it, so usually leave it null), and \`federation\` (if named). Leave any you can't read directly as null — do not compute, infer, or estimate one field from another (e.g. never derive a position from an average speed).

3. NEVER INVENT. If the table has fewer or more columns than the ones described above, or a row is partially illegible, still record what IS legible and leave the rest null — never fabricate a row that isn't there, and never guess a digit you can't read.

4. ONE BIRD. This extract is for a single bird — every row belongs to it. Do not attribute rows to different birds even if the source page has bird-selector chrome around the table.

Use \`extractionNotes\` for caveats about the source itself (a row that's cut off, a column you couldn't read at all) — empty string if none.`;

export function resultsExtractionUserPrompt(filenameHint: string): string {
  return `Extract every race result row from the attached race-history table (source file: "${filenameHint}"). Follow every rule in the system prompt: keep \`raw\` complete for every row even where a structured field is also filled in, and never invent or compute a value that isn't directly readable.`;
}

export const PROSE_SYSTEM_PROMPT = `You are writing the narrative sections of an OudeLuck Lofts pedigree certificate for a child bird, from its already-verified merged ancestor tree (sire's side and dam's side, human-checked). Every fact you write MUST trace directly to a \`notes\`, \`notesEn\`, or \`results\` entry on a specific bird in the tree you were given. Do not add anything else, and do not soften this into "reads well" prose that loses precision — precision is the whole point, this goes to buyers.

Rules:

1. TRACEABILITY. Every factual claim (a result, a title, a lineage claim) must come from the supplied tree. If you cannot point to the specific bird and note/result it came from, leave it out.

2. LOFT CREDENTIALS ARE SEPARATE. A claim that describes the loft or breeder as a whole (e.g. "1st National General Champion six times", a loft's overall breeding history) is a loft credential, not a fact about the specific bird's own performance. Put these in \`loftCredentials\`, each with the loft name and the claim, never blended into a bird's own race record.

3. OWN RECORD VS RELATIVES' RECORD. \`sireOwnRecord\` and \`damOwnRecord\` describe ONLY that specific bird's own results — not a sibling's, not a cousin's. A claim like "full sister to 10 federation winners" describes a relative, not the bird's own racing record; if worth keeping, it belongs in \`breeding\` or \`lineBreedingOfNote\`, clearly attributed to the relative, never presented as the bird's own placing.

4. LINE-BREEDING. \`lineBreedingOfNote\` should call out any ancestor that appears more than once in the tree (the merge step will tell you which, with generation/notation) — describe what that means for the pairing, still grounded only in what the tree actually shows.

5. \`breeding\` is the overview paragraph: who sired/dammed whom, at a level a buyer can read at a glance, still fact-checked against the tree.

Write plainly and specifically. Prefer "raced 390km Graaff-Reinet, 17th of 1100 (2022)" over vague praise. If a section has nothing traceable to say, return a short honest sentence saying so rather than inventing content.`;
