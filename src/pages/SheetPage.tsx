import { useEffect, useRef, useState } from 'react';
import PedigreeSheet, { type EditMode, type PrintVariant } from '../components/PedigreeSheet';
import BirdEditor from '../components/BirdEditor';
import { getChildPedigree, getSettings, patchPedigree, updateBird, exportPedigreeHtml, type LoftSettings } from '../lib/api';
import type { Bird, PedigreeProse } from '../../shared/types';
import type { RingFieldOrder } from '../../shared/ring';
import type { LayoutState } from '../lib/layout';
import { buildExportHtml, downloadHtml } from '../lib/exportHtml';
import { TEMPLATES, DEFAULT_TEMPLATE_ID, templateById } from '../lib/templates';
import { setPrintPageSize } from '../lib/printPageSize';

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

  async function saveLayout() {
    setSaving(true);
    setError(undefined);
    try {
      await patchPedigree(childPedigreeId, { layout, ringFieldOrder, printVariant, template: templateId });
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
        </div>
      </div>

      <p className="no-print mb-4 text-xs text-neutral-500">{currentTemplate.description}</p>

      {showChildEditor && (
        <div className="no-print mb-4 max-w-xl">
          <BirdEditor bird={child} onSave={saveChildEdits} />
        </div>
      )}

      <div className="overflow-auto rounded-lg border border-neutral-200 bg-neutral-100 p-6">
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
  );
}
