// Geometry for the pedigree sheet (build brief §4 Phase 4, extended with a
// second layout family per the "other templates for pedigree layout"
// follow-up). Two layout kinds share one A4 page, sized per orientation:
//
// - 'tree'  (landscape): child on the left, sire's ancestry filling the top
//   band, dam's filling the bottom band, subdividing binarily generation by
//   generation into a column per generation — the original layout.
// - 'list'  (portrait): child as a strip across the top, then every present
//   ancestor as a single indented column below (sire's side complete, then
//   dam's), one row per ancestor rather than one fixed slot per possible
//   ancestor — a compact "5-generation pedigree list" format.
//
// Both algorithms return the same PedigreeBox[] shape, so everything
// downstream (Box, drag/resize overrides, per-box font scale) is unaware
// of which one produced a given box.
//
// Orthogonal to layoutKind is headerStyle — where the loft's own branding
// sits: the original horizontal 'band' across the top, or a 'sidebar' down
// the left edge (per a reference sample template request — a real loft's
// own pedigree design used a dark left column for logo/contact info
// instead of a top band). Either way the content area (child + ancestor
// grid) fills whatever's left; buildTreeBoxes/buildListBoxes place boxes
// from `contentX`/`contentY`, never assuming the header eats space from
// the top specifically.

import type { Bird, PedigreeSide } from '../../shared/types';

export type LayoutKind = 'tree' | 'list';
export type Orientation = 'landscape' | 'portrait';
export type HeaderStyle = 'band' | 'sidebar';

const HEADER_H = 92;
const SIDEBAR_W = 200;
const MARGIN_X = 16;
const BOTTOM_GAP = 26;

export interface SheetGeometry {
  canvasW: number;
  canvasH: number;
  headerH: number; // 0 when headerStyle is 'sidebar'
  sidebarW: number; // 0 when headerStyle is 'band'
  marginX: number;
  contentX: number; // left edge of the content area (accounts for a sidebar)
  contentY: number; // top of the content area (accounts for a header band)
  contentH: number;
  contentW: number;
  orientation: Orientation;
  headerStyle: HeaderStyle;
}

export function geometryFor(orientation: Orientation, headerStyle: HeaderStyle = 'band'): SheetGeometry {
  const canvasW = orientation === 'landscape' ? 1122 : 793; // A4 @ 96dpi, either way up
  const canvasH = orientation === 'landscape' ? 793 : 1122;

  if (headerStyle === 'sidebar') {
    const contentX = SIDEBAR_W + MARGIN_X;
    const contentY = MARGIN_X;
    return {
      canvasW,
      canvasH,
      headerH: 0,
      sidebarW: SIDEBAR_W,
      marginX: MARGIN_X,
      contentX,
      contentY,
      contentH: canvasH - contentY - BOTTOM_GAP,
      contentW: canvasW - contentX - MARGIN_X,
      orientation,
      headerStyle,
    };
  }

  const contentY = HEADER_H + 10;
  return {
    canvasW,
    canvasH,
    headerH: HEADER_H,
    sidebarW: 0,
    marginX: MARGIN_X,
    contentX: MARGIN_X,
    contentY,
    contentH: canvasH - contentY - BOTTOM_GAP,
    contentW: canvasW - 2 * MARGIN_X,
    orientation,
    headerStyle,
  };
}

export interface PedigreeBox {
  id: string;
  bird: Bird;
  x: number;
  y: number;
  w: number;
  h: number;
  generation: number; // 0 = child, 1 = parents, 2 = grandparents, ...
  band?: 'sire' | 'dam';
}

const MAX_GENERATIONS = 4; // how deep either layout will place ancestors

// ---- 'tree' layout: child column + a column per generation, sire/dam split
// top/bottom, subdividing binarily within each band. -------------------------
function buildTreeBoxes(child: Bird, indexById: Map<string, Bird>, geo: SheetGeometry): PedigreeBox[] {
  const childW = 172;
  const colW = (geo.contentW - childW) / MAX_GENERATIONS;

  const boxes: PedigreeBox[] = [{ id: child.id, bird: child, x: geo.contentX, y: geo.contentY, w: childW, h: geo.contentH, generation: 0 }];

  function place(id: string | undefined, band: 'sire' | 'dam', path: PedigreeSide[], generation: number) {
    if (!id || generation > MAX_GENERATIONS) return;
    const bird = indexById.get(id);
    if (!bird) return;

    const bandY = band === 'sire' ? geo.contentY : geo.contentY + geo.contentH / 2;
    const bandH = geo.contentH / 2;
    const rows = Math.pow(2, generation - 1);
    const rowH = bandH / rows;

    const subPath = path.slice(1); // steps after the band's own root
    let rowIndex = 0;
    for (const step of subPath) rowIndex = rowIndex * 2 + (step === 'dam' ? 1 : 0);

    const x = geo.contentX + childW + (generation - 1) * colW;
    const y = bandY + rowIndex * rowH;

    boxes.push({ id: bird.id, bird, x, y, w: colW, h: rowH, generation, band });

    place(bird.sireId, band, [...path, 'sire'], generation + 1);
    place(bird.damId, band, [...path, 'dam'], generation + 1);
  }

  place(child.sireId, 'sire', ['sire'], 1);
  place(child.damId, 'dam', ['dam'], 1);

  return boxes;
}

// ---- 'list' layout: child strip on top, then every ancestor that's
// actually present as one row below — sire's side depth-first, then dam's
// — indented per generation instead of boxed into a fixed grid slot, so a
// sparse tree stays compact instead of leaving blank space. -----------------
function buildListBoxes(child: Bird, indexById: Map<string, Bird>, geo: SheetGeometry): PedigreeBox[] {
  const childSpan = 320; // height of the child's own strip across the top
  const gap = 10;
  const listY = geo.contentY + childSpan + gap;
  const listH = geo.contentH - childSpan - gap;
  const indentStep = 28; // px of left-indent per generation deep

  const boxes: PedigreeBox[] = [{ id: child.id, bird: child, x: geo.contentX, y: geo.contentY, w: geo.contentW, h: childSpan, generation: 0 }];

  interface Entry {
    bird: Bird;
    band: 'sire' | 'dam';
    generation: number;
  }
  const entries: Entry[] = [];

  function walk(id: string | undefined, band: 'sire' | 'dam', generation: number) {
    if (!id || generation > MAX_GENERATIONS) return;
    const bird = indexById.get(id);
    if (!bird) return;
    entries.push({ bird, band, generation });
    walk(bird.sireId, band, generation + 1);
    walk(bird.damId, band, generation + 1);
  }
  walk(child.sireId, 'sire', 1);
  walk(child.damId, 'dam', 1);

  const rowH = listH / Math.max(entries.length, 1);
  entries.forEach((entry, i) => {
    const indent = (entry.generation - 1) * indentStep;
    boxes.push({
      id: entry.bird.id,
      bird: entry.bird,
      x: geo.contentX + indent,
      y: listY + i * rowH,
      w: geo.contentW - indent,
      h: rowH,
      generation: entry.generation,
      band: entry.band,
    });
  });

  return boxes;
}

export function buildBoxes(child: Bird, indexById: Map<string, Bird>, layoutKind: LayoutKind, geo: SheetGeometry): PedigreeBox[] {
  return layoutKind === 'list' ? buildListBoxes(child, indexById, geo) : buildTreeBoxes(child, indexById, geo);
}

// ---- edit-mode state --------------------------------------------------

export interface BoxOverride {
  dx: number;
  dy: number;
  scale: number; // corner-grip resize
  fontScale: number; // A-/A+
  text?: string; // contenteditable override, plain text with \n line breaks
}

export const DEFAULT_OVERRIDE: BoxOverride = { dx: 0, dy: 0, scale: 1, fontScale: 1 };

export type LayoutState = Record<string, Partial<BoxOverride>>;

export function overrideFor(layout: LayoutState, id: string): BoxOverride {
  return { ...DEFAULT_OVERRIDE, ...layout[id] };
}

// Sheet-wide text size (build brief follow-up: "edit the general text
// size"), stored as a pseudo-box entry in the same LayoutState blob rather
// than a separate DB column — `boxes.map(...)` in PedigreeSheet only ever
// iterates the real generated boxes, so this key rides along in the same
// layout JSON (get saved/reset/restored with it) without either side
// needing to know about it specifically. Reuses BoxOverride's fontScale
// field since the meaning ("multiply the text") is identical, just scoped
// to the whole sheet instead of one box.
export const SHEET_SCALE_KEY = '__sheet__';

export function sheetFontScale(layout: LayoutState): number {
  return layout[SHEET_SCALE_KEY]?.fontScale ?? 1;
}
