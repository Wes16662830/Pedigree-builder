import { useEffect, useRef, useState } from 'react';
import { extractPedigreeFile, getReusableBirds } from '../lib/api';
import type { ExtractResponse } from '../lib/api';
import type { Bird } from '../../shared/types';
import { normaliseRing } from '../../shared/ring';
import type { ParentSide, ParentState } from '../App';

interface Props {
  sire?: ParentState;
  dam?: ParentState;
  onExtracted: (side: ParentSide, res: ExtractResponse) => void;
  onReused: (side: ParentSide, bird: Bird) => void;
  onClearSide: (side: ParentSide) => void;
  onVerify: (side: ParentSide) => void;
  onContinueToMerge: () => void;
}

function ReusePicker({ onPick, onCancel }: { onPick: (bird: Bird) => void; onCancel: () => void }) {
  const [birds, setBirds] = useState<Bird[]>();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    getReusableBirds()
      .then(setBirds)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = birds?.filter((b) => !q || b.ring.toLowerCase().includes(q) || (b.name ?? '').toLowerCase().includes(q));

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-600">Pick a bird already on file</span>
        <button onClick={onCancel} className="text-xs text-neutral-500 underline">
          cancel
        </button>
      </div>
      <input
        autoFocus
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
        placeholder="Search by ring or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!birds && !error && <p className="text-xs text-neutral-500">Loading…</p>}
      {filtered && (
        <div className="max-h-48 overflow-auto rounded border bg-white">
          {filtered.length === 0 && <p className="p-2 text-xs text-neutral-500">No verified birds match.</p>}
          {filtered.map((b) => (
            <button
              key={b.id}
              onClick={() => onPick(b)}
              className="flex w-full items-center justify-between border-b px-2 py-1.5 text-left text-sm last:border-b-0 hover:bg-neutral-50"
            >
              <span className="font-mono">{b.ring}</span>
              <span className="text-xs text-neutral-500">{b.name ?? (b.sireId ? 'has known ancestry' : '')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Dropzone({
  side,
  state,
  onExtracted,
  onReused,
  onClearSide,
  onVerify,
}: {
  side: ParentSide;
  state?: ParentState;
  onExtracted: (side: ParentSide, res: ExtractResponse) => void;
  onReused: (side: ParentSide, bird: Bird) => void;
  onClearSide: (side: ParentSide) => void;
  onVerify: (side: ParentSide) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<'upload' | 'reuse'>('upload');
  const [duplicateRings, setDuplicateRings] = useState<string[]>();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(undefined);
    setDuplicateRings(undefined);
    try {
      const res = await extractPedigreeFile(file);
      onExtracted(side, res);
      // Best-effort duplicate check — a bird already on file with the same
      // ring as one just extracted probably means this scan (or part of
      // it) was uploaded before. Non-fatal if it fails.
      try {
        const existing = await getReusableBirds();
        const existingRings = new Set(existing.map((b) => normaliseRing(b.ring)));
        const dupes = res.extracted.birds.map((b) => b.ring).filter((ring) => existingRings.has(normaliseRing(ring)));
        if (dupes.length) setDuplicateRings([...new Set(dupes)]);
      } catch {
        // ignore — duplicate detection is a nice-to-have, not a blocker
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-1 font-semibold capitalize">{side}'s pedigree</h3>
      <p className="mb-3 text-xs text-neutral-500">Any loft, any format — image or PDF. Or reuse a bird you've already verified.</p>

      {!state && (
        <>
          <div className="mb-2 flex overflow-hidden rounded-md border text-xs">
            <button
              onClick={() => setMode('upload')}
              className={`flex-1 py-1.5 ${mode === 'upload' ? 'bg-neutral-900 text-white' : 'bg-white'}`}
            >
              Upload new scan
            </button>
            <button
              onClick={() => setMode('reuse')}
              className={`flex-1 py-1.5 ${mode === 'reuse' ? 'bg-neutral-900 text-white' : 'bg-white'}`}
            >
              Use existing bird
            </button>
          </div>

          {mode === 'upload' && (
            <div
              className="cursor-pointer rounded-md border-2 border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 hover:border-neutral-400"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              {busy ? 'Extracting…' : 'Click or drag a scan / PDF here'}
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          )}

          {mode === 'reuse' && <ReusePicker onPick={(bird) => onReused(side, bird)} onCancel={() => setMode('upload')} />}
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {duplicateRings && duplicateRings.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Already on file: <span className="font-mono">{duplicateRings.join(', ')}</span>. This scan may have been uploaded before — check the Bird
          Library, or use "Use existing bird" above instead of re-verifying it.
        </div>
      )}

      {state?.kind === 'upload' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm">
            <span>
              {state.extracted.birds.length} birds extracted from {state.extracted.sourceFile}
            </span>
            <span className={state.verified ? 'text-green-600' : 'text-amber-600'}>{state.verified ? 'Verified' : 'Needs verification'}</span>
          </div>
          {state.extracted.extractionNotes && <p className="text-xs italic text-neutral-500">Model note: {state.extracted.extractionNotes}</p>}
          {!state.verified && (
            <button onClick={() => onVerify(side)} className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600">
              Open verification screen
            </button>
          )}
          <button
            onClick={() => {
              setDuplicateRings(undefined);
              onClearSide(side);
            }}
            className="w-full text-xs text-neutral-500 underline"
          >
            Start over
          </button>
        </div>
      )}

      {state?.kind === 'reused' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
            <span>
              <span className="font-mono">{state.bird.ring}</span> {state.bird.name && `"${state.bird.name}"`}
            </span>
            <span className="text-green-600">Already verified — reused</span>
          </div>
          <button onClick={() => onClearSide(side)} className="w-full text-xs text-neutral-500 underline">
            Pick a different bird
          </button>
        </div>
      )}
    </div>
  );
}

export default function UploadPage({ sire, dam, onExtracted, onReused, onClearSide, onVerify, onContinueToMerge }: Props) {
  const bothReady = (sire?.kind === 'reused' || sire?.verified) && (dam?.kind === 'reused' || dam?.verified);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">New pedigree</h1>
      <p className="mb-6 text-sm text-neutral-500">
        For each side, either upload a scan (one vision extraction call, then verify) or reuse a bird you've already verified — no need to re-upload the
        same pedigree twice.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Dropzone side="sire" state={sire} onExtracted={onExtracted} onReused={onReused} onClearSide={onClearSide} onVerify={onVerify} />
        <Dropzone side="dam" state={dam} onExtracted={onExtracted} onReused={onReused} onClearSide={onClearSide} onVerify={onVerify} />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          disabled={!bothReady}
          onClick={onContinueToMerge}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: '#111111' }}
        >
          Continue to merge →
        </button>
      </div>
    </div>
  );
}
