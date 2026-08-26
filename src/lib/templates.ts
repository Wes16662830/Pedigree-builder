// Sheet templates — a curated set, not a free-form theme builder. Each pairs
// a color scheme with a genuine layout choice (src/lib/layout.ts's 'tree' vs
// 'list' box-placement algorithms, landscape vs portrait) rather than only
// swapping colors on one fixed layout, per the "other templates for
// pedigree layout" follow-up. editMode, printVariant, and per-box
// drag/resize overrides work the same regardless of which one is picked.

import type { HeaderStyle, LayoutKind, Orientation } from './layout';

export interface SheetTemplate {
  id: string;
  label: string;
  description: string;
  accent: string; // the heading/band accent colour
  ink: string; // the "black" header/body text colour
  layoutKind: LayoutKind;
  orientation: Orientation;
  decorative?: boolean; // ornate double border + serif header, "certificate" look
  photoMaxHeight?: number; // child photo cap in px; default 110
  paperTint?: string; // subtle page background; default white
  headerStyle?: HeaderStyle; // 'band' (default) across the top, or 'sidebar' down the left edge
  // Flips the body palette (secondary text tones, box background/border,
  // the "unconfirmed" warning colour) from light-page-dark-text to
  // dark-page-light-text — see paletteFor in PedigreeSheet.tsx. Only worth
  // setting alongside a dark paperTint; every other template assumes a
  // light page, same as before this existed.
  dark?: boolean;
  // Draws a gold/accent "elbow" line from each box to its own sire/dam
  // box, tracing the family tree explicitly rather than relying on
  // generation-column position alone to imply the relationship. 'tree'
  // layout only (built-in reference sample request: a real loft's dark,
  // gold-accented pedigree with explicit connector lines).
  connectorLines?: boolean;
}

export const TEMPLATES: SheetTemplate[] = [
  {
    id: 'classic-gold',
    label: 'OudeLuck Classic',
    description: 'The original layout — landscape, child on the left, sire/dam ancestry fanning out in generation columns.',
    accent: '#D19A45',
    ink: '#111111',
    layoutKind: 'tree',
    orientation: 'landscape',
  },
  {
    id: 'minimal-slate',
    label: 'Minimal Slate',
    description: 'Same classic tree layout, cooler slate-grey palette.',
    accent: '#64748B',
    ink: '#1E293B',
    layoutKind: 'tree',
    orientation: 'landscape',
  },
  {
    id: 'racing-red',
    label: 'Racing Red',
    description: 'Same classic tree layout, racing-red accent.',
    accent: '#B91C1C',
    ink: '#18181B',
    layoutKind: 'tree',
    orientation: 'landscape',
  },
  {
    id: 'forest-green',
    label: 'Forest Green',
    description: 'Same classic tree layout, deep green accent.',
    accent: '#15803D',
    ink: '#14532D',
    layoutKind: 'tree',
    orientation: 'landscape',
  },
  {
    id: 'photo-showcase',
    label: 'Photo Showcase',
    description: 'Classic tree layout with a much larger child photo — for when you have a strong shot of the bird itself.',
    accent: '#C2703D',
    ink: '#1F1B16',
    layoutKind: 'tree',
    orientation: 'landscape',
    photoMaxHeight: 240,
  },
  {
    id: 'heritage-list',
    label: 'Heritage List',
    description: 'A compact portrait list: the child up top, then every known ancestor stacked below as one indented column — sire’s side, then dam’s — instead of a boxed chart. Fits a sparse or deep tree onto one page without leaving blank slots.',
    accent: '#7C2D12',
    ink: '#1C1917',
    layoutKind: 'list',
    orientation: 'portrait',
    paperTint: '#FDFAF5',
  },
  {
    id: 'certificate-ivory',
    label: 'Certificate',
    description: 'The classic tree layout turned portrait, with an ornate double border and a formal serif header — styled for framing or a formal buyer handover.',
    accent: '#946C1F',
    ink: '#2B2118',
    layoutKind: 'tree',
    orientation: 'portrait',
    decorative: true,
    paperTint: '#FBF6EA',
  },
  {
    id: 'loft-sidebar',
    label: 'Loft Sidebar',
    description:
      'A dark charcoal column down the left edge carries the logo and loft details instead of a top band, freeing the full width above the ancestry for the chart itself — modeled on a real loft’s own printed pedigree design.',
    accent: '#D19A45',
    ink: '#111111',
    layoutKind: 'tree',
    orientation: 'landscape',
    headerStyle: 'sidebar',
  },
  {
    id: 'onyx-gold',
    label: 'Onyx & Gold',
    description:
      'A dark charcoal canvas throughout with gold-line ancestry — every box connects to its own sire and dam with an explicit elbow line, rather than relying on column position alone. Modeled on a real loft’s own dark pedigree design.',
    accent: '#C9A227',
    ink: '#F2F2ED',
    layoutKind: 'tree',
    orientation: 'landscape',
    headerStyle: 'sidebar',
    paperTint: '#3A3A3C',
    dark: true,
    connectorLines: true,
  },
];

export const DEFAULT_TEMPLATE_ID = TEMPLATES[0].id;

export function templateById(id: string | undefined): SheetTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
