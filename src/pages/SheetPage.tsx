import { useEffect, useRef, useState } from 'react';
import PedigreeSheet, { type EditMode, type PrintVariant } from '../components/PedigreeSheet';
import { getChildPedigree, patchPedigree, exportPedigreeHtml } from '../lib/api';
import type { Bird, PedigreeProse } from '../../shared/types';
import type { RingFieldOrder } from '../../shared/ring';
import type { LayoutState } from '../lib/layout';
import { buildExportHtml, downloadHtml } from '../lib/exportHtml';

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
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [childPedigreeId]);

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
      await patchPedigree(childPedigreeId, { layout, ringFieldOrder, printVariant });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function doExport() {
    if (!sheetRef.current || !child) return;
    await saveLayout();
    const html = buildExportHtml(sheetRef.current.outerHTML, `OudeLuck Pedigree — ${child.ring}`);
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

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="rounded-md border px-3 py-1.5 text-sm">
          ← Back
        </button>

        <div className="ml-2 flex overflow-hidden rounded-md border text-sm">
          {(['view', 'text', 'layout'] as EditMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setEditMode(m)}
              className={`px-3 py-1.5 capitalize ${editMode === m ? 'bg-neutral-900 text-white' : 'bg-white'}`}
            >
              {m}
            </button>
          ))}
        </div>

        <label className="ml-2 flex items-center gap-1 text-sm">
          Print:
          <select className="rounded border px-2 py-1" value={printVariant} onChange={(e) => setPrintVariant(e.target.value as PrintVariant)}>
            <option value="black-header">Black header</option>
            <option value="white-panel">White panel (inkjet-friendly)</option>
          </select>
        </label>

        <label className="flex items-center gap-1 text-sm">
          Ring order:
          <select className="rounded border px-2 py-1" value={ringFieldOrder} onChange={(e) => setRingFieldOrder(e.target.value as RingFieldOrder)}>
            <option value="ring-year">ring, then year</option>
            <option value="year-ring">year, then ring</option>
          </select>
        </label>

        {editMode === 'layout' && (
          <button onClick={resetAll} className="rounded-md border px-3 py-1.5 text-sm">
            Reset all layout
          </button>
        )}

        <div className="ml-auto flex gap-2">
          <button disabled={saving} onClick={saveLayout} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => window.print()} className="rounded-md border px-3 py-1.5 text-sm">
            Print
          </button>
          <button onClick={doExport} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: '#111111' }}>
            Export HTML
          </button>
        </div>
      </div>

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
          onLayoutChange={onLayoutChange}
          onResetBox={onResetBox}
        />
      </div>
    </div>
  );
}
