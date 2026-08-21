import { useRef } from 'react';
import type { Bird } from '../../shared/types';
import type { PedigreeProse } from '../../shared/types';
import type { RingFieldOrder } from '../../shared/ring';
import { formatRing, parseRingTokens } from '../../shared/ring';
import type { LoftSettings } from '../lib/api';
import { templateById } from '../lib/templates';
import { buildBoxes, geometryFor, overrideFor, type LayoutState } from '../lib/layout';

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
    <div>
      {bird.photoUrl && <img src={bird.photoUrl} alt={bird.ring} style={{ width: '100%', maxHeight: 60, objectFit: 'cover', borderRadius: 3, marginBottom: 3 }} />}
      <div style={{ fontWeight: 700 }}>{displayRing(bird.ring, ringFieldOrder)}</div>
      {bird.name && <div style={{ fontStyle: 'italic' }}>"{bird.name}"</div>}
      <div>
        {bird.sex === 'unknown' ? <span style={{ color: RED, fontStyle: 'italic' }}>sex: unknown</span> : bird.sex}
        {bird.colour ? ` · ${bird.colour}` : ''}
      </div>
      {bird.breeder && <div style={{ opacity: 0.8 }}>{bird.breeder}</div>}
      {bird.notes.map((n, i) => (
        <div key={i} style={{ fontSize: '0.85em', opacity: 0.85, marginTop: 2 }}>
          {n}
          {bird.notesEn?.[i] && <div style={{ fontStyle: 'italic', opacity: 0.7 }}>({bird.notesEn[i]})</div>}
        </div>
      ))}
      {bird.results.map((r, i) => (
        <ResultLine key={i} raw={r.raw} missing={r.position === undefined && r.poolSize === undefined} />
      ))}
    </div>
  );
}

function ChildBoxBody({
  child,
  prose,
  ringFieldOrder,
  accent,
  photoMaxHeight = 110,
}: {
  child: Bird;
  prose: PedigreeProse;
  ringFieldOrder: RingFieldOrder;
  accent: string;
  photoMaxHeight?: number;
}) {
  return (
    <div>
      {child.photoUrl && (
        <img src={child.photoUrl} alt={child.ring} style={{ width: '100%', maxHeight: photoMaxHeight, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />
      )}
      <div style={{ fontSize: 18, fontWeight: 800 }}>{displayRing(child.ring, ringFieldOrder)}</div>
      {child.name && <div style={{ fontStyle: 'italic', fontSize: 14 }}>"{child.name}"</div>}
      <div style={{ marginTop: 2 }}>
        {child.sex === 'unknown' ? <span style={{ color: RED, fontStyle: 'italic' }}>sex: unknown</span> : child.sex}
        {child.colour ? ` · ${child.colour}` : ''}
      </div>
      {child.breeder && <div style={{ opacity: 0.85 }}>{child.breeder}</div>}
      {child.loftAddress && <div style={{ fontSize: '0.85em', opacity: 0.7 }}>{child.loftAddress}</div>}

      <hr style={{ margin: '8px 0', borderColor: '#ddd' }} />

      <div style={{ fontWeight: 700, fontSize: '0.9em', color: accent }}>BREEDING</div>
      <p style={{ fontSize: '0.85em', marginBottom: 6 }}>{prose.breeding}</p>

      <div style={{ fontWeight: 700, fontSize: '0.9em', color: accent }}>LINE-BREEDING OF NOTE</div>
      <p style={{ fontSize: '0.85em', marginBottom: 6 }}>{prose.lineBreedingOfNote || <span style={{ color: RED, fontStyle: 'italic' }}>none detected</span>}</p>

      <div style={{ fontWeight: 700, fontSize: '0.9em', color: accent }}>SIRE'S OWN RECORD</div>
      <p style={{ fontSize: '0.85em', marginBottom: 6 }}>{prose.sireOwnRecord}</p>

      <div style={{ fontWeight: 700, fontSize: '0.9em', color: accent }}>DAM'S OWN RECORD</div>
      <p style={{ fontSize: '0.85em', marginBottom: 6 }}>{prose.damOwnRecord}</p>

      {prose.loftCredentials.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: '0.9em', color: accent }}>LOFT CREDENTIALS</div>
          {prose.loftCredentials.map((c, i) => (
            <p key={i} style={{ fontSize: '0.8em', marginBottom: 3 }}>
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
}) {
  const ov = overrideFor(layout, boxId);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; scale: number } | null>(null);

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
        padding: 4,
        paddingTop: editMode === 'layout' ? 20 : 4,
        overflow: 'auto',
        fontSize: `${11 * ov.fontScale}px`,
        background: '#fff',
        outline: editMode === 'layout' ? '1px dashed transparent' : undefined,
        cursor: editMode === 'layout' ? 'move' : undefined,
      }}
      onMouseDown={startDrag}
      className="pedigree-box"
    >
      {children}

      {editMode === 'layout' && (
        <div
          contentEditable={false}
          className="no-print"
          style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 2, background: 'rgba(255,255,255,0.9)' }}
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
            <button title="Reset this box" onMouseDown={(e) => e.stopPropagation()} onClick={() => onResetBox(boxId)} style={miniBtn}>
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
            width: 10,
            height: 10,
            background: accent,
            cursor: 'nwse-resize',
          }}
        />
      )}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  fontSize: 10,
  lineHeight: 1,
  padding: '2px 4px',
  border: '1px solid #999',
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
  const geo = geometryFor(tmpl.orientation);
  const boxes = buildBoxes(child, indexById, tmpl.layoutKind, geo);

  const headerBg = printVariant === 'black-header' ? INK : '#fff';
  const headerFg = printVariant === 'black-header' ? '#fff' : INK;
  const { accent } = tmpl;
  const loftName = loft?.name?.trim() || DEFAULT_LOFT_NAME;
  const loftSubtitle = loft?.subtitle?.trim() || DEFAULT_LOFT_SUBTITLE;
  const loftAddress = loft?.address?.trim() || DEFAULT_LOFT_ADDRESS;
  const fontFamily = tmpl.decorative ? 'Georgia, "Times New Roman", serif' : 'Arial, Helvetica, sans-serif';

  // Divider between sire's and dam's side, positioned from where the
  // actual boxes landed rather than a fixed offset — works the same for
  // the 'tree' layout's top/bottom bands and the 'list' layout's single
  // indented column, without either needing to know about the other.
  const ancestorBoxes = boxes.filter((b) => b.generation > 0);
  const sireBoxes = ancestorBoxes.filter((b) => b.band === 'sire');
  const damBoxes = ancestorBoxes.filter((b) => b.band === 'dam');
  const dividerX1 = ancestorBoxes.length ? Math.min(...ancestorBoxes.map((b) => b.x)) : geo.marginX;
  const dividerX2 = ancestorBoxes.length ? Math.max(...ancestorBoxes.map((b) => b.x + b.w)) : geo.canvasW - geo.marginX;
  const sireStartY = sireBoxes.length ? Math.min(...sireBoxes.map((b) => b.y)) : geo.contentY;
  const damStartY = damBoxes.length ? Math.min(...damBoxes.map((b) => b.y)) : geo.contentY + geo.contentH / 2;

  const borderInset = tmpl.decorative ? 12 : 0;

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
        background: '#fff',
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

      {/* Header band */}
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
        }}
      >
        {/* Logo: the loft's own uploaded mark (Settings → Loft) when set,
            otherwise a plain initial-letter placeholder in the template's
            accent colour — kept inline so the sheet stays self-contained. */}
        {loft?.logoDataUrl ? (
          <img
            src={loft.logoDataUrl}
            alt={loftName}
            style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', marginRight: 16, flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 6,
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
            {loftName
              .split(/\s+/)
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'OL'}
          </div>
        )}
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>{loftName}</div>
          <div style={{ fontSize: 12, color: accent }}>
            {loftSubtitle} · {loftAddress}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Pedigree Certificate</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{displayRing(child.ring, ringFieldOrder)}</div>
        </div>
      </div>

      {/* Sire's-side / dam's-side divider, positioned from wherever the
          ancestor boxes actually landed (see dividerX1/2, sireStartY,
          damStartY above) so it works for both the 'tree' layout's
          top/bottom bands and the 'list' layout's single stacked column. */}
      {damBoxes.length > 0 && (
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
      )}
      {sireBoxes.length > 0 && (
        <div style={{ position: 'absolute', left: dividerX1, top: sireStartY - 14, fontSize: 10, fontWeight: 700, color: accent }}>SIRE'S SIDE</div>
      )}
      {damBoxes.length > 0 && (
        <div style={{ position: 'absolute', left: dividerX1, top: damStartY + 2, fontSize: 10, fontWeight: 700, color: accent }}>DAM'S SIDE</div>
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
        >
          {box.generation === 0 ? (
            <ChildBoxBody child={child} prose={prose} ringFieldOrder={ringFieldOrder} accent={accent} photoMaxHeight={tmpl.photoMaxHeight} />
          ) : (
            <AncestorBoxBody bird={box.bird} ringFieldOrder={ringFieldOrder} />
          )}
        </Box>
      ))}
    </div>
  );
}
