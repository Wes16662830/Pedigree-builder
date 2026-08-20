// Geometry for the pedigree sheet (build brief §4 Phase 4): A4 landscape,
// child on the left, sire's ancestry filling the top band, dam's filling
// the bottom band, subdividing binarily generation by generation — a
// "4-column grid" of ancestor generations next to the child's own column.

import type { Bird, PedigreeSide } from '../../shared/types';

export const CANVAS_W = 1122; // A4 landscape @ 96dpi
export const CANVAS_H = 793;
export const HEADER_H = 92;
export const MARGIN_X = 16;
export const CHILD_W = 172;
export const GEN_COLS = 4;

export const CONTENT_Y = HEADER_H + 10;
export const CONTENT_H = CANVAS_H - HEADER_H - 26;
export const COL_W = (CANVAS_W - 2 * MARGIN_X - CHILD_W) / GEN_COLS;

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

export function buildBoxes(child: Bird, indexById: Map<string, Bird>): PedigreeBox[] {
  const boxes: PedigreeBox[] = [
    { id: child.id, bird: child, x: MARGIN_X, y: CONTENT_Y, w: CHILD_W, h: CONTENT_H, generation: 0 },
  ];

  function place(id: string | undefined, band: 'sire' | 'dam', path: PedigreeSide[], generation: number) {
    if (!id || generation > GEN_COLS) return;
    const bird = indexById.get(id);
    if (!bird) return;

    const bandY = band === 'sire' ? CONTENT_Y : CONTENT_Y + CONTENT_H / 2;
    const bandH = CONTENT_H / 2;
    const rows = Math.pow(2, generation - 1);
    const rowH = bandH / rows;

    const subPath = path.slice(1); // steps after the band's own root
    let rowIndex = 0;
    for (const step of subPath) rowIndex = rowIndex * 2 + (step === 'dam' ? 1 : 0);

    const x = MARGIN_X + CHILD_W + (generation - 1) * COL_W;
    const y = bandY + rowIndex * rowH;

    boxes.push({ id: bird.id, bird, x, y, w: COL_W, h: rowH, generation, band });

    place(bird.sireId, band, [...path, 'sire'], generation + 1);
    place(bird.damId, band, [...path, 'dam'], generation + 1);
  }

  place(child.sireId, 'sire', ['sire'], 1);
  place(child.damId, 'dam', ['dam'], 1);

  return boxes;
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
