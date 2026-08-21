// The sheet's own canvas size already matches one A4 page exactly (see
// src/lib/layout.ts's geometryFor) — but which way up depends on the
// selected template (landscape 'tree' templates vs portrait 'list'/
// 'certificate' ones), and the browser's @page rule has to match or the
// printed/PDF'd page comes out the wrong orientation regardless of how
// the on-screen sheet itself is sized. There's only ever one sheet being
// printed at a time, so rather than fight CSS Paged Media's named-page
// support (patchy outside Chromium), this just rewrites a single global
// @page rule to match right before printing.

import type { Orientation } from './layout';

const STYLE_ID = 'dynamic-page-size';

export function setPrintPageSize(orientation: Orientation) {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: A4 ${orientation}; margin: 0; }`;
}
