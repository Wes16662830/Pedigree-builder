// Visual themes for the rendered pedigree sheet — a curated set, not a
// free-form theme builder. Each just swaps the accent/header colors that
// PedigreeSheet.tsx already parameterised; the grid geometry, edit modes,
// and print variant (§7's white-panel option) are unaffected by which one
// is picked.

export interface SheetTemplate {
  id: string;
  label: string;
  accent: string; // the "gold" band/heading colour
  ink: string; // the "black" header/body text colour
}

export const TEMPLATES: SheetTemplate[] = [
  { id: 'classic-gold', label: 'OudeLuck Classic', accent: '#D19A45', ink: '#111111' },
  { id: 'minimal-slate', label: 'Minimal Slate', accent: '#64748B', ink: '#1E293B' },
  { id: 'racing-red', label: 'Racing Red', accent: '#B91C1C', ink: '#18181B' },
  { id: 'forest-green', label: 'Forest Green', accent: '#15803D', ink: '#14532D' },
];

export const DEFAULT_TEMPLATE_ID = TEMPLATES[0].id;

export function templateById(id: string | undefined): SheetTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
