import { useRef } from 'react';
import type { Bird } from '../../shared/types';
import type { PedigreeProse } from '../../shared/types';
import type { RingFieldOrder } from '../../shared/ring';
import { formatRing, parseRingTokens } from '../../shared/ring';
import {
  CANVAS_H,
  CANVAS_W,
  CONTENT_H,
  CONTENT_Y,
  HEADER_H,
  MARGIN_X,
  buildBoxes,
  overrideFor,
  type LayoutState,
} from '../lib/layout';

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
  onLayoutChange: (id: string, patch: Partial<LayoutState[string]>) => void;
  onResetBox: (id: string) => void;
  sheetRef?: React.Ref<HTMLDivElement>;
}

const GOLD = '#D19A45';
const INK = '#111111';
const RED = '#dc2626';

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

function ChildBoxBody({ child, prose, ringFieldOrder }: { child: Bird; prose: PedigreeProse; ringFieldOrder: RingFieldOrder }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{displayRing(child.ring, ringFieldOrder)}</div>
      {child.name && <div style={{ fontStyle: 'italic', fontSize: 14 }}>"{child.name}"</div>}
      <div style={{ marginTop: 2 }}>
        {child.sex === 'unknown' ? <span style={{ color: RED, fontStyle: 'italic' }}>sex: unknown</span> : child.sex}
        {child.colour ? ` · ${child.colour}` : ''}
      </div>
      {child.breeder && <div style={{ opacity: 0.85 }}>{child.breeder}</div>}
      {child.loftAddress && <div style={{ fontSize: '0.85em', opacity: 0.7 }}>{child.loftAddress}</div>}

      <hr style={{ margin: '8px 0', borderColor: '#ddd' }} />

      <div style={{ fontWeight: 700, fontSize: '0.9em', color: GOLD }}>BREEDING</div>
      <p style={{ fontSize: '0.85em', marginBottom: 6 }}>{prose.breeding}</p>

      <div style={{ fontWeight: 700, fontSize: '0.9em', color: GOLD }}>LINE-BREEDING OF NOTE</div>
      <p style={{ fontSize: '0.85em', marginBottom: 6 }}>{prose.lineBreedingOfNote || <span style={{ color: RED, fontStyle: 'italic' }}>none detected</span>}</p>

      <div style={{ fontWeight: 700, fontSize: '0.9em', color: GOLD }}>SIRE'S OWN RECORD</div>
      <p style={{ fontSize: '0.85em', marginBottom: 6 }}>{prose.sireOwnRecord}</p>

      <div style={{ fontWeight: 700, fontSize: '0.9em', color: GOLD }}>DAM'S OWN RECORD</div>
      <p style={{ fontSize: '0.85em', marginBottom: 6 }}>{prose.damOwnRecord}</p>

      {prose.loftCredentials.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: '0.9em', color: GOLD }}>LOFT CREDENTIALS</div>
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
        border: `1px solid ${highlight ? GOLD : '#ccc'}`,
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
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 10,
            height: 10,
            background: GOLD,
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

export default function PedigreeSheet({ child, tree, prose, layout, editMode, printVariant, ringFieldOrder, onLayoutChange, onResetBox, sheetRef }: Props) {
  const indexById = new Map(tree.map((b) => [b.id, b]));
  const boxes = buildBoxes(child, indexById);

  const headerBg = printVariant === 'black-header' ? INK : '#fff';
  const headerFg = printVariant === 'black-header' ? '#fff' : INK;

  return (
    <div
      ref={sheetRef}
      className="pedigree-sheet"
      contentEditable={editMode === 'text'}
      suppressContentEditableWarning
      style={{
        position: 'relative',
        width: CANVAS_W,
        height: CANVAS_H,
        background: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: INK,
        margin: '0 auto',
        boxShadow: '0 0 0 1px #ddd',
      }}
    >
      {/* Header band */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CANVAS_W,
          height: HEADER_H,
          background: headerBg,
          color: headerFg,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          borderBottom: `4px solid ${GOLD}`,
          boxSizing: 'border-box',
        }}
      >
        {/* Logo placeholder — swap `src` for the real base64-embedded OudeLuck
            crest asset when available; kept as an inline SVG so the sheet
            stays fully self-contained with no external file reference. */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 6,
            background: GOLD,
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
          OL
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>OudeLuck Lofts</div>
          <div style={{ fontSize: 12, color: GOLD }}>OneLoft Genetics · Athlone Farm, Tarkastad, Eastern Cape</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Pedigree Certificate</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{displayRing(child.ring, ringFieldOrder)}</div>
        </div>
      </div>

      {/* Band divider hint (sire above / dam below) */}
      <div
        style={{
          position: 'absolute',
          left: MARGIN_X + 172,
          top: CONTENT_Y + CONTENT_H / 2 - 1,
          width: CANVAS_W - MARGIN_X * 2 - 172,
          height: 2,
          background: '#eee',
        }}
      />
      <div style={{ position: 'absolute', left: MARGIN_X + 172, top: CONTENT_Y - 14, fontSize: 10, fontWeight: 700, color: GOLD }}>SIRE'S SIDE</div>
      <div style={{ position: 'absolute', left: MARGIN_X + 172, top: CONTENT_Y + CONTENT_H / 2 + 2, fontSize: 10, fontWeight: 700, color: GOLD }}>DAM'S SIDE</div>

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
        >
          {box.generation === 0 ? (
            <ChildBoxBody child={child} prose={prose} ringFieldOrder={ringFieldOrder} />
          ) : (
            <AncestorBoxBody bird={box.bird} ringFieldOrder={ringFieldOrder} />
          )}
        </Box>
      ))}
    </div>
  );
}
