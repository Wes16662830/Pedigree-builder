import { useLayoutEffect, useRef, useState } from 'react';
import type { Bird } from '../../shared/types';
import type { PedigreeProse } from '../../shared/types';
import type { RingFieldOrder } from '../../shared/ring';
import { formatRing, parseRingTokens } from '../../shared/ring';
import type { LoftSettings } from '../lib/api';
import { templateById } from '../lib/templates';
import { buildBoxes, geometryFor, overrideFor, type LayoutState } from '../lib/layout';
import { repeatedAncestorGroups } from '../../shared/crossref';

export type EditMode = 'view' | 'text' | 'layout';
export type PrintVariant = 'black-header' | 'white-panel';

interface Props {
  child: Bird;
  tree: Bird[];
  prose: PedigreeProse;
  layout: LayoutState;
  editMode: EditMode;
  printVariant: PrintVariant;
  ringFieldOrder: RingFieldOrder;
  templateId: string;
  loft?: LoftSettings;
  onLayoutChange: (id: string, patch: Partial<LayoutState[string]>) => void;
  onResetBox: (id: string) => void;
  sheetRef?: React.Ref<HTMLDivElement>;
}

const INK = '#111111';
const RED = '#dc2626';
const DEFAULT_LOFT_NAME = 'OudeLuck Lofts';
const DEFAULT_LOFT_SUBTITLE = 'OneLoft Genetics';
const DEFAULT_LOFT_ADDRESS = 'Athlone Farm, Tarkastad, Eastern Cape';

// Repeated-ancestor highlight colours — the same convention some source
// pedigree software already uses (build brief follow-up): every box for
// the same physical ancestor, wherever it recurs in the tree, gets the
// same background tint so line-breeding is visible at a glance, not just
// described in the prose. Cycled by group index; if a tree has more
// distinct repeated ancestors than colours, colours repeat — acceptable,
// the prose text underneath still spells out exactly which bird and
// generations each one is.
const REPEAT_HIGHLIGHT_COLORS = ['#DBEAFE', '#FEF3C7', '#D1FAE5', '#FCE7F3', '#E9D5FF', '#FFEDD5', '#E5E7EB', '#CFFAFE'];

function buildRepeatColorMap(tree: Bird[], childId: string): Map<string, string> {
  const groups = repeatedAncestorGroups(tree, childId);
  const map = new Map<string, string>();
  groups.forEach((ids, i) => {
    const color = REPEAT_HIGHLIGHT_COLORS[i % REPEAT_HIGHLIGHT_COLORS.length];
    for (const id of ids) map.set(id, color);
  });
  return map;
}

function displayRing(ring: string, order: RingFieldOrder): string {
  const { country, year, rest } = parseRingTokens(ring);
  if (!country && !year) return ring; // couldn't parse confidently — never guess, show verbatim
  return formatRing(country, year, rest, { fieldOrder: order });
}

function ResultLine({ raw, missing }: { raw: string; missing: boolean }) {
  return (
    <div style={{ fontSize: 'inherit', lineHeight: 1.3 }}>
      {raw || <span style={{ color: RED, fontStyle: 'italic' }}>[result not recorded — unconfirmed]</span>}
      {missing && !raw.includes('[') && <span style={{ color: RED, fontStyle: 'italic' }}> — unrecorded</span>}
    </div>
  );
}

function AncestorBoxBody({ bird, ringFieldOrder }: { bird: Bird; ringFieldOrder: RingFieldOrder }) {
  return (
    <div style={{ lineHeight: 1.35 }}>
      {bird.photoUrl && <img src={bird.photoUrl} alt={bird.ring} style={{ width: '100%', maxHeight: 60, objectFit: 'cover', borderRadius: 3, marginBottom: 4 }} />}
      <div style={{ fontWeight: 700, marginBottom: 1 }}>{displayRing(bird.ring, ringFieldOrder)}</div>
      {bird.name && <div style={{ fontStyle: 'italic', marginBottom: 1 }}>"{bird.name}"</div>}
      <div style={{ color: '#444' }}>
        {bird.sex === 'unknown' ? <span style={{ color: RED, fontStyle: 'italic' }}>sex: unknown</span> : bird.sex}
        {bird.colour ? ` · ${bird.colour}` : ''}
      </div>
      {bird.breeder && <div style={{ color: '#666' }}>{bird.breeder}</div>}
      {bird.notes.length > 0 && (
        <div style={{ marginTop: 3, borderTop: '1px solid #eee', paddingTop: 2 }}>
          {bird.notes.map((n, i) => (
            <div key={i} style={{ fontSize: '0.85em', color: '#555', marginTop: i > 0 ? 2 : 0 }}>
              {n}
              {bird.notesEn?.[i] && <div style={{ fontStyle: 'italic', color: '#888' }}>({bird.notesEn[i]})</div>}
            </div>
          ))}
        </div>
      )}
      {bird.results.length > 0 && (
        <div style={{ marginTop: 3, borderTop: '1px solid #eee', paddingTop: 2 }}>
          {bird.results.map((r, i) => (
            <ResultLine key={i} raw={r.raw} missing={r.position === undefined && r.poolSize === undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildBoxBody({
  child,
  prose,
  ringFieldOrder,
  accent,
  photoMaxHeight = 110,
  hasRepeatedAncestors,
}: {
  child: Bird;
  prose: PedigreeProse;
  ringFieldOrder: RingFieldOrder;
  accent: string;
  photoMaxHeight?: number;
  hasRepeatedAncestors: boolean;
}) {
  const sectionHeading: React.CSSProperties = {
    fontWeight: 700,
    fontSize: '0.85em',
    color: accent,
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 3,
  };
  return (
    <div style={{ lineHeight: 1.4 }}>
      {child.photoUrl && (
        <img src={child.photoUrl} alt={child.ring} style={{ width: '100%', maxHeight: photoMaxHeight, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }} />
      )}
      <div style={{ fontSize: 18, fontWeight: 800 }}>{displayRing(child.ring, ringFieldOrder)}</div>
      {child.name && <div style={{ fontStyle: 'italic', fontSize: 14, marginTop: 1 }}>"{child.name}"</div>}
      <div style={{ marginTop: 3, color: '#444' }}>
        {child.sex === 'unknown' ? <span style={{ color: RED, fontStyle: 'italic' }}>sex: unknown</span> : child.sex}
        {child.colour ? ` · ${child.colour}` : ''}
      </div>
      {child.breeder && <div style={{ color: '#666' }}>{child.breeder}</div>}
      {child.loftAddress && <div style={{ fontSize: '0.85em', color: '#888' }}>{child.loftAddress}</div>}

      <hr style={{ margin: '10px 0 0', borderColor: '#ddd' }} />

      <div style={{ ...sectionHeading, marginTop: 8 }}>BREEDING</div>
      <p style={{ fontSize: '0.85em', marginBottom: 0 }}>{prose.breeding}</p>

      <div style={sectionHeading}>LINE-BREEDING OF NOTE</div>
      <p style={{ fontSize: '0.85em', marginBottom: 0 }}>{prose.lineBreedingOfNote || <span style={{ color: RED, fontStyle: 'italic' }}>none detected</span>}</p>
      {hasRepeatedAncestors && (
        <p style={{ fontSize: '0.75em', color: '#888', fontStyle: 'italic', marginTop: 2, marginBottom: 0 }}>
          Matching coloured boxes on this sheet mark the same ancestor appearing more than once.
        </p>
      )}

      <div style={sectionHeading}>SIRE'S OWN RECORD</div>
      <p style={{ fontSize: '0.85em', marginBottom: 0 }}>{prose.sireOwnRecord}</p>

      <div style={sectionHeading}>DAM'S OWN RECORD</div>
      <p style={{ fontSize: '0.85em', marginBottom: 0 }}>{prose.damOwnRecord}</p>

      {prose.loftCredentials.length > 0 && (
        <>
          <div style={sectionHeading}>LOFT CREDENTIALS</div>
          {prose.loftCredentials.map((c, i) => (
            <p key={i} style={{ fontSize: '0.8em', marginBottom: i === prose.loftCredentials.length - 1 ? 0 : 4 }}>
              <strong>{c.loftName}:</strong> {c.claim}
            </p>
          ))}
        </>
      )}
    </div>
  );
}

function Box({
  boxId,
  x,
  y,
  w,
  h,
  editMode,
  layout,
  onLayoutChange,
  onResetBox,
  children,
  highlight,
  accent,
  fillColor,
  contentVersion,
}: {
  boxId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  editMode: EditMode;
  layout: LayoutState;
  onLayoutChange: (id: string, patch: Partial<LayoutState[string]>) => void;
  onResetBox: (id: string) => void;
  children: React.ReactNode;
  highlight?: boolean;
  accent: string;
  // Set when this box's bird is a repeated ancestor (line-breeding) —
  // tints the box so every box for that same physical bird is visibly
  // the same colour, wherever it recurs in the tree. See
  // buildRepeatColorMap above.
  fillColor?: string;
  // A cheap, stable signal that the box's actual content changed (each
  // bird's own `updatedAt`) — see the measurement effect below for why
  // this needs to be a real dependency rather than "just remeasure every
  // render".
  contentVersion: string;
}) {
  const ov = overrideFor(layout, boxId);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; scale: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  function startDrag(e: React.MouseEvent) {
    if (editMode !== 'layout') return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: ov.dx, oy: ov.dy };
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      onLayoutChange(boxId, { dx: dragRef.current.ox + (ev.clientX - dragRef.current.startX), dy: dragRef.current.oy + (ev.clientY - dragRef.current.startY) });
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startResize(e: React.MouseEvent) {
    if (editMode !== 'layout') return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, scale: ov.scale };
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX + (ev.clientY - resizeRef.current.startY);
      const scale = Math.min(3, Math.max(0.3, resizeRef.current.scale + delta / 200));
      onLayoutChange(boxId, { scale });
    }
    function onUp() {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (editMode !== 'layout') return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowUp') onLayoutChange(boxId, { dy: ov.dy - step });
    else if (e.key === 'ArrowDown') onLayoutChange(boxId, { dy: ov.dy + step });
    else if (e.key === 'ArrowLeft') onLayoutChange(boxId, { dx: ov.dx - step });
    else if (e.key === 'ArrowRight') onLayoutChange(boxId, { dx: ov.dx + step });
    else return;
    e.preventDefault();
  }

  const isOverridden = ov.dx !== 0 || ov.dy !== 0 || ov.scale !== 1 || ov.fontScale !== 1;

  // Base text size scales gently with the box's own height — a spacious
  // box (the child card, a generation-1 ancestor) reads more comfortably
  // a little larger, while an already-tight box (deep generations, a
  // dense list row) stays at the original floor rather than shrinking
  // further. Per-box A-/A+ overrides still layer on top of this.
  const baseFont = Math.min(14, Math.max(11, 11 + (h - 100) / 150));

  // Auto-shrink dense content to fit its box, rather than relying on a
  // scrollbar (which hides text on screen) or letting print silently clip
  // it (a printed page can't scroll — build brief §7: never silently omit
  // data). If content still doesn't fit at the shrink floor, overflow
  // switches to visible instead of hidden — the box will visually spill
  // into its neighbour, but nothing is ever silently lost; the amber
  // outline below (screen-only) flags it so the operator notices and
  // fixes it by hand (drag/resize/font-scale), same as any other
  // flagged-for-review field.
  //
  // Two things matter for this NOT to become a render loop (build brief
  // regression: this shipped once causing "Maximum update depth exceeded"
  // — see git history):
  //  1. A real dependency array. Re-measuring on every single render
  //     (including ones this box has nothing to do with) means any
  //     borderline box that's ever unstable keeps re-triggering itself
  //     indefinitely; this only re-measures when this box's own geometry,
  //     font-scale, edit mode, or content could plausibly have changed.
  //  2. Fixed, discrete shrink steps rather than an accumulating
  //     `factor -= 0.08` loop. Repeated floating-point subtraction can
  //     land on a very slightly different value from one run to the next
  //     for the exact same content, which right at a text-wrap boundary
  //     can flip `scrollHeight` by a whole line — i.e. the same content
  //     measuring as "fits" on one run and "overflows" on the next,
  //     oscillating forever. Snapping to a fixed step list makes the
  //     result a pure function of the content: same input, same output.
  const SHRINK_STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6];
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let stepIndex = 0;
    el.style.fontSize = '100%';
    while (el.scrollHeight > el.clientHeight + 1 && stepIndex < SHRINK_STEPS.length - 1) {
      stepIndex += 1;
      el.style.fontSize = `${SHRINK_STEPS[stepIndex] * 100}%`;
    }
    const nowOverflowing = el.scrollHeight > el.clientHeight + 1;
    setOverflowing((prev) => (prev === nowOverflowing ? prev : nowOverflowing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, ov.fontScale, editMode, contentVersion]);

  return (
    <div
      data-box-id={boxId}
      tabIndex={editMode === 'layout' ? 0 : undefined}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `translate(${ov.dx}px, ${ov.dy}px) scale(${ov.scale})`,
        transformOrigin: 'top left',
        border: `1px solid ${highlight ? accent : '#ccc'}`,
        boxSizing: 'border-box',
        background: fillColor ?? '#fff',
        cursor: editMode === 'layout' ? 'move' : undefined,
        // An overflowing box's content spills past its own slot into
        // whatever's below it (see contentRef's overflow:visible above) —
        // lift it above and give it a shadow so that reads as "this card
        // is floating over its lane on purpose" rather than a rendering
        // glitch or the box below going missing.
        zIndex: overflowing ? 5 : undefined,
        boxShadow: overflowing ? '0 2px 10px rgba(0,0,0,0.18)' : undefined,
      }}
      onMouseDown={startDrag}
      className="pedigree-box"
    >
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          inset: 0,
          padding: 6,
          paddingTop: editMode === 'layout' ? 22 : 6,
          boxSizing: 'border-box',
          overflow: overflowing ? 'visible' : 'hidden',
          fontSize: `${baseFont * ov.fontScale}px`,
          outline: editMode === 'layout' ? '1px dashed #cbd5e1' : undefined,
          outlineOffset: editMode === 'layout' ? -1 : undefined,
        }}
      >
        {children}
      </div>

      {overflowing && (
        <div
          title="This box's content doesn't fit — drag its corner to resize, or use A− to shrink the text, so nothing prints cut off."
          className="no-print"
          style={{ position: 'absolute', inset: 0, border: '2px solid #f59e0b', pointerEvents: 'none' }}
        />
      )}

      {editMode === 'layout' && (
        <div
          contentEditable={false}
          className="no-print"
          style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 2, background: 'rgba(255,255,255,0.92)', borderRadius: 3 }}
        >
          <button
            title="Smaller text"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onLayoutChange(boxId, { fontScale: Math.max(0.5, ov.fontScale - 0.1) })}
            style={miniBtn}
          >
            A−
          </button>
          <button
            title="Larger text"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onLayoutChange(boxId, { fontScale: Math.min(2, ov.fontScale + 0.1) })}
            style={miniBtn}
          >
            A+
          </button>
          {isOverridden && (
            <button title="Reset this box to its default position/size" onMouseDown={(e) => e.stopPropagation()} onClick={() => onResetBox(boxId)} style={miniBtn}>
              ↺
            </button>
          )}
        </div>
      )}

      {editMode === 'layout' && (
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          className="no-print"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 15,
            height: 15,
            background: accent,
            borderRadius: '3px 0 3px 0',
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 9,
            lineHeight: 1,
          }}
        >
          ⤡
        </div>
      )}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  fontSize: 10,
  lineHeight: 1,
  padding: '3px 5px',
  border: '1px solid #999',
  borderRadius: 3,
  background: '#fff',
  cursor: 'pointer',
};

export default function PedigreeSheet({
  child,
  tree,
  prose,
  layout,
  editMode,
  printVariant,
  ringFieldOrder,
  templateId,
  loft,
  onLayoutChange,
  onResetBox,
  sheetRef,
}: Props) {
  const indexById = new Map(tree.map((b) => [b.id, b]));
  const tmpl = templateById(templateId);
  const geo = geometryFor(tmpl.orientation, tmpl.headerStyle);
  const boxes = buildBoxes(child, indexById, tmpl.layoutKind, geo);
  const repeatColorMap = buildRepeatColorMap(tree, child.id);

  const headerBg = printVariant === 'black-header' ? INK : '#fff';
  const headerFg = printVariant === 'black-header' ? '#fff' : INK;
  const { accent } = tmpl;
  const loftName = loft?.name?.trim() || DEFAULT_LOFT_NAME;
  const loftSubtitle = loft?.subtitle?.trim() || DEFAULT_LOFT_SUBTITLE;
  const loftAddress = loft?.address?.trim() || DEFAULT_LOFT_ADDRESS;
  const loftInitials =
    loftName
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OL';
  const fontFamily = tmpl.decorative ? 'Georgia, "Times New Roman", serif' : 'Arial, Helvetica, sans-serif';

  // Divider between sire's and dam's side, positioned from where the
  // actual boxes landed rather than a fixed offset — works the same for
  // the 'tree' layout's top/bottom bands and the 'list' layout's single
  // indented column, without either needing to know about the other.
  const ancestorBoxes = boxes.filter((b) => b.generation > 0);
  const sireBoxes = ancestorBoxes.filter((b) => b.band === 'sire');
  const damBoxes = ancestorBoxes.filter((b) => b.band === 'dam');
  const dividerX1 = ancestorBoxes.length ? Math.min(...ancestorBoxes.map((b) => b.x)) : geo.contentX;
  const dividerX2 = ancestorBoxes.length ? Math.max(...ancestorBoxes.map((b) => b.x + b.w)) : geo.canvasW - geo.marginX;
  const sireStartY = sireBoxes.length ? Math.min(...sireBoxes.map((b) => b.y)) : geo.contentY;
  const damStartY = damBoxes.length ? Math.min(...damBoxes.map((b) => b.y)) : geo.contentY + geo.contentH / 2;

  const borderInset = tmpl.decorative ? 12 : 0;
  const paperTint = tmpl.paperTint ?? '#fff';
  const logoRadius = tmpl.decorative ? '50%' : 6;

  return (
    <div
      ref={sheetRef}
      className="pedigree-sheet"
      contentEditable={editMode === 'text'}
      suppressContentEditableWarning
      style={{
        position: 'relative',
        width: geo.canvasW,
        height: geo.canvasH,
        background: paperTint,
        fontFamily,
        color: INK,
        margin: '0 auto',
        boxShadow: '0 0 0 1px #ddd',
      }}
    >
      {tmpl.decorative && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: borderInset,
              border: `2px solid ${accent}`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: borderInset + 5,
              border: `1px solid ${accent}`,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {tmpl.headerStyle === 'sidebar' ? (
        /* Sidebar branding column, per a real loft's own printed pedigree
           (build brief follow-up: "make a template like these examples").
           Runs the full height of the sheet down the left edge instead of
           a top band, so the ancestry chart gets the full canvas width.
           Same never-truncate-the-ring rule as the band: the ring block
           is pinned to the bottom of a flex column rather than squeezed
           by long free-text name/address above it. */
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: geo.sidebarW,
            height: geo.canvasH,
            background: headerBg,
            color: headerFg,
            borderRight: `4px solid ${accent}`,
            boxSizing: 'border-box',
            padding: '22px 16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {loft?.logoDataUrl ? (
            <img src={loft.logoDataUrl} alt={loftName} style={{ width: 72, height: 72, borderRadius: logoRadius, objectFit: 'cover', marginBottom: 16, flexShrink: 0 }} />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: logoRadius,
                background: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: INK,
                fontWeight: 900,
                fontSize: 24,
                marginBottom: 16,
                flexShrink: 0,
              }}
            >
              {loftInitials}
            </div>
          )}
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: 19,
                fontWeight: 800,
                letterSpacing: 0.3,
                lineHeight: 1.25,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {loftName}
            </div>
            <div style={{ fontSize: 12, color: accent, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loftSubtitle}</div>
            <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 6, lineHeight: 1.4 }}>{loftAddress}</div>
          </div>

          <div style={{ flex: 1, minHeight: 12 }} />

          <div style={{ borderTop: `1px solid ${accent}`, paddingTop: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 0.8 }}>PEDIGREE CERTIFICATE</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 3, wordBreak: 'break-word' }}>{displayRing(child.ring, ringFieldOrder)}</div>
          </div>
        </div>
      ) : (
        /* Header band. overflow:hidden here is a deliberate safety net: the
           loft name/subtitle/address are free-text from Settings and can be
           arbitrarily long, so the middle block below is what truncates
           (ellipsis) under pressure — never the ring number on the right,
           which is load-bearing (it's what identifies which bird this sheet
           is for) and is never allowed to be pushed off-canvas. */
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: geo.canvasW,
            height: geo.headerH,
            background: headerBg,
            color: headerFg,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            borderBottom: `4px solid ${accent}`,
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* Logo: the loft's own uploaded mark (Settings → Loft) when set,
              otherwise a plain initial-letter placeholder in the template's
              accent colour — kept inline so the sheet stays self-contained. */}
          {loft?.logoDataUrl ? (
            <img
              src={loft.logoDataUrl}
              alt={loftName}
              style={{ width: 56, height: 56, borderRadius: logoRadius, objectFit: 'cover', marginRight: 16, flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: logoRadius,
                background: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: INK,
                fontWeight: 900,
                fontSize: 20,
                marginRight: 16,
                flexShrink: 0,
              }}
            >
              {loftInitials}
            </div>
          )}
          <div style={{ minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loftName}</div>
            <div style={{ fontSize: 12, color: accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {loftSubtitle} · {loftAddress}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', paddingLeft: 12, textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap' }}>Pedigree Certificate</div>
            <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>{displayRing(child.ring, ringFieldOrder)}</div>
          </div>
        </div>
      )}

      {/* Sire's-side / dam's-side divider, positioned from wherever the
          ancestor boxes actually landed (see dividerX1/2, sireStartY,
          damStartY above) so it works for both the 'tree' layout's
          top/bottom bands and the 'list' layout's single stacked column. */}
      {damBoxes.length > 0 &&
        (tmpl.decorative ? (
          <div
            style={{
              position: 'absolute',
              left: dividerX1,
              top: damStartY - 4,
              width: dividerX2 - dividerX1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div style={{ flex: 1, height: 1, background: accent, opacity: 0.5 }} />
            <span style={{ color: accent, fontSize: 8 }}>◆</span>
            <div style={{ flex: 1, height: 1, background: accent, opacity: 0.5 }} />
          </div>
        ) : (
          <div
            style={{
              position: 'absolute',
              left: dividerX1,
              top: damStartY - 3,
              width: dividerX2 - dividerX1,
              height: 2,
              background: '#eee',
            }}
          />
        ))}
      {sireBoxes.length > 0 && (
        <div style={{ position: 'absolute', left: dividerX1, top: sireStartY - 14, fontSize: 10, fontWeight: 700, color: accent }}>♂ SIRE'S SIDE</div>
      )}
      {damBoxes.length > 0 && (
        <div style={{ position: 'absolute', left: dividerX1, top: damStartY + 3, fontSize: 10, fontWeight: 700, color: accent }}>♀ DAM'S SIDE</div>
      )}

      {boxes.map((box) => (
        <Box
          key={box.id}
          boxId={box.id}
          x={box.x}
          y={box.y}
          w={box.w}
          h={box.h}
          editMode={editMode}
          layout={layout}
          onLayoutChange={onLayoutChange}
          onResetBox={onResetBox}
          highlight={box.generation === 0}
          accent={accent}
          fillColor={box.generation === 0 ? undefined : repeatColorMap.get(box.bird.id)}
          contentVersion={box.generation === 0 ? `${child.updatedAt ?? ''}:${JSON.stringify(prose).length}` : (box.bird.updatedAt ?? box.bird.id)}
        >
          {box.generation === 0 ? (
            <ChildBoxBody
              child={child}
              prose={prose}
              ringFieldOrder={ringFieldOrder}
              accent={accent}
              photoMaxHeight={tmpl.photoMaxHeight}
              hasRepeatedAncestors={repeatColorMap.size > 0}
            />
          ) : (
            <AncestorBoxBody bird={box.bird} ringFieldOrder={ringFieldOrder} />
          )}
        </Box>
      ))}
    </div>
  );
}
