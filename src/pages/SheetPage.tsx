import { useEffect, useRef, useState } from 'react';
import PedigreeSheet, { type EditMode, type PrintVariant } from '../components/PedigreeSheet';
import BirdEditor from '../components/BirdEditor';
import { getChildPedigree, getSettings, patchPedigree, updateBird, exportPedigreeHtml, type LoftSettings } from '../lib/api';
import type { Bird, PedigreeProse } from '../../shared/types';
import type { RingFieldOrder } from '../../shared/ring';
import { SHEET_SCALE_KEY, sheetFontScale, type LayoutState } from '../lib/layout';
import { buildExportHtml, downloadHtml } from '../lib/exportHtml';
import { TEMPLATES, DEFAULT_TEMPLATE_ID, templateById } from '../lib/templates';
import { setPrintPageSize } from '../lib/printPageSize';
import { geometryFor } from '../lib/layout';

interface Props {
  childPedigreeId: string;
  onBack: () => void;
}

export default function SheetPage({ childPedigreeId, onBack }: Props) {
  const [child, setChild] = useState<Bird>();
  const [tree, setTree] = useState<Bird[]>([]);
  const [prose, setProse] = useState<PedigreeProse>();
  const [layout, setLayout] = useState<LayoutState>({});
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [printVariant, setPrintVariant] = useState<PrintVariant>('black-header');
  const [ringFieldOrder, setRingFieldOrder] = useState<RingFieldOrder>('ring-year');
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [loft, setLoft] = useState<LoftSettings>();
  const [showChildEditor, setShowChildEditor] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    getChildPedigree(childPedigreeId)
      .then((data) => {
        setChild(data.child);
        setTree(data.tree);
        setProse(data.prose);
        setLayout((data.layout as LayoutState) ?? {});
        setRingFieldOrder((data.ring_field_order as RingFieldOrder) ?? 'ring-year');
        setPrintVariant((data.print_variant as PrintVariant) ?? 'black-header');
        setTemplateId(data.template ?? DEFAULT_TEMPLATE_ID);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
    getSettings()
      .then((s) => setLoft(s.loft))
      .catch(() => {});
  }, [childPedigreeId]);

  // Keep the browser's @page size in sync with whichever template is
  // selected — landscape 'tree' templates vs portrait 'list'/'certificate'
  // ones — so both the in-app Print button and a plain browser Ctrl+P
  // come out the right way up (see src/lib/printPageSize.ts).
  useEffect(() => {
    setPrintPageSize(templateById(templateId).orientation);
  }, [templateId]);

  // Shrink the on-screen preview to fit the available width, rather than
  // showing a landscape (or portrait) sheet wider than the panel and
  // requiring a horizontal scroll to see the rest of the header/ring
  // number. Purely visual — the underlying sheet DOM (and so print/export)
  // stays at true size; see the .sheet-preview-scale print override in
  // index.css. Disabled in Layout edit mode, where drag/resize math
  // assumes real screen pixels == the sheet's own coordinate space.
  //
  // `child` is in the dependency list not because its value matters here,
  // but because `previewRef` isn't attached to anything until the
  // "Loading…" early-return below gives way to the real sheet markup —
  // without this, the effect's first (only) run finds `previewRef.current`
  // still null, and never fires again once the DOM actually mounts if
  // `templateId`/`editMode` happen not to change afterward.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const canvasW = geometryFor(templateById(templateId).orientation).canvasW;
    const PADDING = 48; // matches the preview panel's p-6 (24px each side)
    function update() {
      if (!el) return;
      const available = el.clientWidth - PADDING;
      const next = editMode === 'layout' ? 1 : Math.min(1, available / canvasW);
      // Belt-and-braces against sub-pixel jitter feeding back into another
      // observer firing: skip the update entirely if it wouldn't visibly
      // change anything.
      setPreviewScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [templateId, editMode, child]);

  function onLayoutChange(id: string, patch: Partial<LayoutState[string]>) {
    setLayout((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }
  function onResetBox(id: string) {
    setLayout((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  function resetAll() {
    setLayout({});
  }

  // Text mode (contentEditable across the whole sheet — see PedigreeSheet's
  // suppressContentEditableWarning div) has no per-keystroke React state to
  // read from: the browser owns those DOM edits directly. Rather than fight
  // React+contentEditable's well-known caret-jump problem by reconciling on
  // every input event, capture happens once, here, by reading the live DOM
  // straight off sheetRef right before it's sent — so Save always persists
  // exactly what's on screen, regardless of how the user got there. Scoped
  // to Text mode specifically so a Layout-mode save (dragging a box, the
  // text-size slider) never spuriously freezes every box's content.
  function captureTextEdits(base: LayoutState): LayoutState {
    const sheetEl = sheetRef.current;
    if (!sheetEl || editMode !== 'text') return base;
    const next = { ...base };
    sheetEl.querySelectorAll<HTMLElement>('[data-box-id]').forEach((boxEl) => {
      const boxId = boxEl.getAttribute('data-box-id');
      const contentEl = boxEl.querySelector<HTMLElement>('[data-box-content]');
      if (!boxId || !contentEl) return;
      next[boxId] = { ...next[boxId], text: contentEl.innerHTML };
    });
    return next;
  }

  async function saveLayout() {
    setSaving(true);
    setError(undefined);
    try {
      const withTextEdits = captureTextEdits(layout);
      setLayout(withTextEdits);
      await patchPedigree(childPedigreeId, { layout: withTextEdits, ringFieldOrder, printVariant, template: templateId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onTemplateChange(id: string) {
    setTemplateId(id);
    try {
      await patchPedigree(childPedigreeId, { template: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function saveChildEdits(bird: Bird) {
    setChild(bird);
    try {
      await updateBird(bird.id, bird);
      // Keep the tree in sync in case this same bird also appears there.
      setTree((prev) => prev.map((b) => (b.id === bird.id ? bird : b)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function doExport() {
    if (!sheetRef.current || !child) return;
    await saveLayout();
    const html = buildExportHtml(sheetRef.current.outerHTML, `OudeLuck Pedigree — ${child.ring}`, templateById(templateId).orientation);
    const filename = `${child.ring.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.html`;
    downloadHtml(filename, html);
    try {
      await exportPedigreeHtml(childPedigreeId, html);
    } catch (e) {
      // Non-fatal — the browser download already succeeded.
      console.warn('Server-side export copy failed:', e);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!child || !prose) return <p className="text-sm text-neutral-500">Loading…</p>;

  const currentTemplate = templateById(templateId);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-neutral-200 bg-white p-2.5">
        <button onClick={onBack} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50">
          ← Back
        </button>

        <div className="flex overflow-hidden rounded-md border text-sm">
          <button
            onClick={() => setEditMode('view')}
            title="Read-only preview — what you'll print or export"
            className={`px-3 py-1.5 ${editMode === 'view' ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-50'}`}
          >
            View
          </button>
          <button
            onClick={() => setEditMode('text')}
            title="Click directly into any text on the sheet and edit it in place"
            className={`border-l px-3 py-1.5 ${editMode === 'text' ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-50'}`}
          >
            Text
          </button>
          <button
            onClick={() => setEditMode('layout')}
            title="Drag boxes to reposition, resize by the corner handle, and adjust font size per box"
            className={`border-l px-3 py-1.5 ${editMode === 'layout' ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-50'}`}
          >
            Layout
          </button>
        </div>

        {editMode === 'layout' && (
          <button onClick={resetAll} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50">
            Reset all layout
          </button>
        )}

        <button onClick={() => setShowChildEditor((v) => !v)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50">
          {showChildEditor ? 'Hide child editor' : 'Edit child details / results'}
        </button>

        <div className="ml-auto flex gap-2">
          <button disabled={saving} onClick={saveLayout} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => window.print()} className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50">
            Print / Save as PDF
          </button>
          <button onClick={doExport} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: '#111111' }}>
            Export HTML
          </button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-100 pt-2.5 text-sm">
          <label className="flex items-center gap-1.5" title={currentTemplate.description}>
            <span className="text-neutral-500">Template</span>
            <span className="inline-block h-3 w-3 flex-shrink-0 rounded-full border border-black/10" style={{ background: currentTemplate.accent }} />
            <select className="rounded border px-2 py-1" value={templateId} onChange={(e) => onTemplateChange(e.target.value)}>
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id} title={t.description}>
                  {t.label} · {t.orientation === 'portrait' ? 'portrait' : 'landscape'}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5" title="Which colour the header band prints in — 'White panel' saves ink on a home inkjet">
            <span className="text-neutral-500">Print style</span>
            <select className="rounded border px-2 py-1" value={printVariant} onChange={(e) => setPrintVariant(e.target.value as PrintVariant)}>
              <option value="black-header">Black header</option>
              <option value="white-panel">White panel (inkjet-friendly)</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5" title="How ring numbers are formatted throughout the sheet">
            <span className="text-neutral-500">Ring order</span>
            <select className="rounded border px-2 py-1" value={ringFieldOrder} onChange={(e) => setRingFieldOrder(e.target.value as RingFieldOrder)}>
              <option value="ring-year">ring, then year</option>
              <option value="year-ring">year, then ring</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5" title="Scales all text on the sheet at once — on top of any per-box A-/A+ adjustments">
            <span className="text-neutral-500">Text size</span>
            <input
              type="range"
              min={70}
              max={150}
              step={5}
              value={Math.round(sheetFontScale(layout) * 100)}
              onChange={(e) => onLayoutChange(SHEET_SCALE_KEY, { fontScale: Number(e.target.value) / 100 })}
              className="w-28"
            />
            <span className="w-9 font-mono text-xs text-neutral-500">{Math.round(sheetFontScale(layout) * 100)}%</span>
            {sheetFontScale(layout) !== 1 && (
              <button
                type="button"
                onClick={() => onLayoutChange(SHEET_SCALE_KEY, { fontScale: 1 })}
                className="text-xs text-neutral-400 underline hover:text-neutral-700"
              >
                Reset
              </button>
            )}
          </label>
        </div>
      </div>

      <p className="no-print mb-4 text-xs text-neutral-500">{currentTemplate.description}</p>

      {showChildEditor && (
        <div className="no-print mb-4 max-w-xl">
          <BirdEditor bird={child} onSave={saveChildEdits} />
        </div>
      )}

      {/* previewRef measures THIS outer div, not the scrollable one below it
          — deliberately: the inner div's own scrollbar can appear/disappear
          as a side effect of the scale we compute from it, and on a browser
          where scrollbars consume layout space, measuring the same element
          you're scrolling creates a self-referential resize/rescale loop
          (see git history — this is what "Maximum update depth exceeded"
          on portrait templates turned out to be). This outer div has no
          overflow/scroll of its own, so its width can never be affected by
          anything happening inside it. */}
      <div ref={previewRef}>
        <div className="overflow-auto rounded-lg border border-neutral-200 bg-neutral-100 p-6">
          <div
            className="sheet-preview-scale"
            style={{
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
              width: geometryFor(currentTemplate.orientation).canvasW * previewScale,
              height: geometryFor(currentTemplate.orientation).canvasH * previewScale,
            }}
          >
            <PedigreeSheet
              sheetRef={sheetRef}
              child={child}
              tree={tree}
              prose={prose}
              layout={layout}
              editMode={editMode}
              printVariant={printVariant}
              ringFieldOrder={ringFieldOrder}
              templateId={templateId}
              loft={loft}
              onLayoutChange={onLayoutChange}
              onResetBox={onResetBox}
            />
          </div>
        </div>
      </div>
      {previewScale < 1 && (
        <p className="no-print mt-2 text-center text-xs text-neutral-400">Shown at {Math.round(previewScale * 100)}% to fit — prints/exports at full size.</p>
      )}
    </div>
  );
}
