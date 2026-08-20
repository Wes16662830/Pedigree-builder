import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bird, Result, Sex } from '../../shared/types';
import { CONFIDENCE_FLAG_THRESHOLD } from '../../shared/types';
import { completeUploadVerification, getBirdsBySource, setBirdVerified, updateBird } from '../lib/api';
import type { ParentSide, ParentUploadState } from '../App';

interface Props {
  side: ParentSide;
  state?: ParentUploadState;
  onDone: () => void;
  onCancel: () => void;
}

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function ResultRow({ result, onChange, onRemove }: { result: Result; onChange: (r: Result) => void; onRemove: () => void }) {
  return (
    <div className="grid grid-cols-6 gap-1 rounded border border-neutral-200 p-2 text-xs">
      <input className="col-span-2 rounded border px-1 py-0.5" placeholder="race" value={result.race} onChange={(e) => onChange({ ...result, race: e.target.value })} />
      <input
        className="rounded border px-1 py-0.5"
        placeholder="year"
        type="number"
        value={result.year ?? ''}
        onChange={(e) => onChange({ ...result, year: e.target.value ? Number(e.target.value) : undefined })}
      />
      <input
        className="rounded border px-1 py-0.5"
        placeholder="position"
        type="number"
        value={result.position ?? ''}
        onChange={(e) => onChange({ ...result, position: e.target.value ? Number(e.target.value) : undefined })}
      />
      <input
        className="rounded border px-1 py-0.5"
        placeholder="pool"
        type="number"
        value={result.poolSize ?? ''}
        onChange={(e) => onChange({ ...result, poolSize: e.target.value ? Number(e.target.value) : undefined })}
      />
      <button onClick={onRemove} className="rounded border border-red-200 px-1 text-red-600 hover:bg-red-50">
        remove
      </button>
      <input
        className="col-span-6 rounded border px-1 py-0.5 font-mono"
        placeholder="verbatim source text"
        value={result.raw}
        onChange={(e) => onChange({ ...result, raw: e.target.value })}
      />
      {result.position === undefined && (
        <p className="col-span-6 fill">No position/pool recorded — will render as an unrecorded placeholder, not omitted.</p>
      )}
    </div>
  );
}

function BirdCard({ bird, active, onFocus, onSave, onVerifyToggle }: { bird: Bird; active: boolean; onFocus: () => void; onSave: (b: Bird) => void; onVerifyToggle: (v: boolean) => void }) {
  const [local, setLocal] = useState(bird);
  useEffect(() => setLocal(bird), [bird.id]);

  const lowConfidence = local.confidence < CONFIDENCE_FLAG_THRESHOLD;

  function commit(patch: Partial<Bird>) {
    const next = { ...local, ...patch };
    setLocal(next);
    onSave(next);
  }

  return (
    <div
      onClick={onFocus}
      className={`rounded-lg border p-3 transition ${active ? 'border-neutral-900 ring-2 ring-neutral-900' : 'border-neutral-200'} ${lowConfidence ? 'bg-amber-50' : 'bg-white'}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="truncate font-mono text-xs text-neutral-500">{bird.id}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs ${lowConfidence ? 'bg-amber-200 text-amber-900' : 'bg-neutral-100 text-neutral-600'}`}>
          confidence {(local.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="col-span-2">
          <span className="block text-xs text-neutral-500">Ring (verbatim)</span>
          <input className="w-full rounded border px-2 py-1 font-mono" value={local.ring} onChange={(e) => commit({ ring: e.target.value })} onBlur={() => onSave(local)} />
        </label>
        <label>
          <span className="block text-xs text-neutral-500">Name</span>
          <input className="w-full rounded border px-2 py-1" value={local.name ?? ''} onChange={(e) => commit({ name: e.target.value })} onBlur={() => onSave(local)} />
        </label>
        <label>
          <span className="block text-xs text-neutral-500">Sex</span>
          <select
            className={`w-full rounded border px-2 py-1 ${local.sex === 'unknown' ? 'text-red-600' : ''}`}
            value={local.sex}
            onChange={(e) => {
              const sex = e.target.value as Sex;
              commit({ sex });
              onSave({ ...local, sex });
            }}
          >
            <option value="unknown">unknown</option>
            <option value="cock">cock</option>
            <option value="hen">hen</option>
          </select>
        </label>
        <label>
          <span className="block text-xs text-neutral-500">Colour</span>
          <input className="w-full rounded border px-2 py-1" value={local.colour ?? ''} onChange={(e) => commit({ colour: e.target.value })} onBlur={() => onSave(local)} />
        </label>
        <label>
          <span className="block text-xs text-neutral-500">Breeder</span>
          <input className="w-full rounded border px-2 py-1" value={local.breeder ?? ''} onChange={(e) => commit({ breeder: e.target.value })} onBlur={() => onSave(local)} />
        </label>
        <label className="col-span-2">
          <span className="block text-xs text-neutral-500">Notes (verbatim source wording, one per line)</span>
          <textarea
            className="w-full rounded border px-2 py-1 font-mono text-xs"
            rows={2}
            value={local.notes.join('\n')}
            onChange={(e) => commit({ notes: linesToArray(e.target.value) })}
            onBlur={() => onSave(local)}
          />
        </label>
        <label className="col-span-2">
          <span className="block text-xs text-neutral-500">English translation (only if source isn't English)</span>
          <textarea
            className="w-full rounded border px-2 py-1 text-xs"
            rows={2}
            value={(local.notesEn ?? []).join('\n')}
            onChange={(e) => commit({ notesEn: linesToArray(e.target.value) })}
            onBlur={() => onSave(local)}
          />
        </label>

        <div className="col-span-2 space-y-1">
          <span className="block text-xs text-neutral-500">Results</span>
          {local.results.map((r, i) => (
            <ResultRow
              key={i}
              result={r}
              onChange={(nr) => {
                const results = local.results.map((rr, ii) => (ii === i ? nr : rr));
                commit({ results });
                onSave({ ...local, results });
              }}
              onRemove={() => {
                const results = local.results.filter((_, ii) => ii !== i);
                commit({ results });
                onSave({ ...local, results });
              }}
            />
          ))}
          <button
            className="text-xs text-neutral-500 underline"
            onClick={() => {
              const results = [...local.results, { race: '', raw: '' }];
              commit({ results });
            }}
          >
            + add result
          </button>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={bird.verified} onChange={(e) => onVerifyToggle(e.target.checked)} />
        Verified against original
      </label>
    </div>
  );
}

export default function VerifyPage({ side, state, onDone, onCancel }: Props) {
  const [birds, setBirds] = useState<Bird[]>(state?.extracted.birds ?? []);
  const [activeId, setActiveId] = useState<string | undefined>(birds[0]?.id);
  const [error, setError] = useState<string>();
  const [finishing, setFinishing] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    getBirdsBySource(state.extracted.sourceFile)
      .then((fresh) => {
        if (fresh.length) setBirds(fresh);
      })
      .catch(() => {});
  }, [state?.extracted.sourceFile]);

  const orderedBirds = useMemo(
    () => [...birds].sort((a, b) => a.confidence - b.confidence),
    [birds],
  );
  const activeIndex = orderedBirds.findIndex((b) => b.id === activeId);
  const allVerified = birds.length > 0 && birds.every((b) => b.verified);

  if (!state) return <p>No upload selected.</p>;

  const isPdf = state.fileUrl.toLowerCase().endsWith('.pdf');

  async function save(bird: Bird) {
    setBirds((prev) => prev.map((b) => (b.id === bird.id ? bird : b)));
    try {
      await updateBird(bird.id, bird);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function verifyToggle(bird: Bird, verified: boolean) {
    const updated = { ...bird, verified };
    setBirds((prev) => prev.map((b) => (b.id === bird.id ? updated : b)));
    try {
      await setBirdVerified(bird.id, verified);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function finish() {
    if (!state) return;
    setFinishing(true);
    setError(undefined);
    try {
      await completeUploadVerification(state.uploadId, state.extracted.sourceFile);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not all birds are verified yet.');
    } finally {
      setFinishing(false);
    }
  }

  function step(delta: number) {
    const next = orderedBirds[Math.min(Math.max(activeIndex + delta, 0), orderedBirds.length - 1)];
    if (next) setActiveId(next.id);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold capitalize">Verify — {side}'s pedigree</h1>
          <p className="text-sm text-neutral-500">
            {birds.filter((b) => b.verified).length} / {birds.length} birds verified. Sorted lowest-confidence first — clear the amber ones.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm">
            Back
          </button>
          <button onClick={() => step(-1)} className="rounded-md border px-3 py-1.5 text-sm">
            ← Prev
          </button>
          <button onClick={() => step(1)} className="rounded-md border px-3 py-1.5 text-sm">
            Next →
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div ref={imgRef} className="sticky top-4 h-[75vh] self-start overflow-auto rounded-lg border border-neutral-200 bg-neutral-100">
          {isPdf ? (
            <iframe title="original pedigree" src={state.fileUrl} className="h-full w-full" />
          ) : (
            <img src={state.fileUrl} alt="original pedigree" className="w-full" />
          )}
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-auto pr-1">
          {orderedBirds.map((b) => (
            <BirdCard
              key={b.id}
              bird={b}
              active={b.id === activeId}
              onFocus={() => setActiveId(b.id)}
              onSave={save}
              onVerifyToggle={(v) => verifyToggle(b, v)}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          disabled={!allVerified || finishing}
          onClick={finish}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: '#111111' }}
        >
          {finishing ? 'Saving…' : 'Mark verification complete'}
        </button>
      </div>
    </div>
  );
}
