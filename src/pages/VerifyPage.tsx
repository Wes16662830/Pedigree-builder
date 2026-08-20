import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bird } from '../../shared/types';
import { CONFIDENCE_FLAG_THRESHOLD } from '../../shared/types';
import { completeUploadVerification, getBirdsBySource, setBirdVerified, updateBird } from '../lib/api';
import type { ParentSide, ParentUploadState } from '../App';
import BirdEditor from '../components/BirdEditor';

interface Props {
  side: ParentSide;
  state?: ParentUploadState;
  onDone: () => void;
  onCancel: () => void;
}

export default function VerifyPage({ side, state, onDone, onCancel }: Props) {
  const [birds, setBirds] = useState<Bird[]>(state?.extracted.birds ?? []);
  const [activeId, setActiveId] = useState<string | undefined>(birds[0]?.id);
  const [error, setError] = useState<string>();
  const [finishing, setFinishing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    getBirdsBySource(state.extracted.sourceFile)
      .then((fresh) => {
        if (fresh.length) setBirds(fresh);
      })
      .catch(() => {});
  }, [state?.extracted.sourceFile]);

  const orderedBirds = useMemo(() => [...birds].sort((a, b) => a.confidence - b.confidence), [birds]);
  const activeIndex = orderedBirds.findIndex((b) => b.id === activeId);
  const allVerified = birds.length > 0 && birds.every((b) => b.verified);
  const highConfidenceUnverified = birds.filter((b) => !b.verified && b.confidence >= CONFIDENCE_FLAG_THRESHOLD);

  // Keyboard shortcuts: arrow keys step through the list, "v" toggles the
  // active card's verified state. Ignored while typing in a field so it
  // doesn't hijack normal text editing.
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key.toLowerCase() === 'v') {
        const active = orderedBirds.find((b) => b.id === activeId);
        if (active) verifyToggle(active, !active.verified);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedBirds, activeId]);

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

  async function verifyAllHighConfidence() {
    setBulkBusy(true);
    setError(undefined);
    try {
      for (const bird of highConfidenceUnverified) {
        await setBirdVerified(bird.id, true);
      }
      setBirds((prev) => prev.map((b) => (b.confidence >= CONFIDENCE_FLAG_THRESHOLD ? { ...b, verified: true } : b)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk verify failed');
    } finally {
      setBulkBusy(false);
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
            {birds.filter((b) => b.verified).length} / {birds.length} birds verified. Sorted lowest-confidence first — clear the amber ones. Arrow keys
            step through, "v" toggles verified.
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

      {highConfidenceUnverified.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
          <span>
            {highConfidenceUnverified.length} bird{highConfidenceUnverified.length === 1 ? '' : 's'} at or above {Math.round(CONFIDENCE_FLAG_THRESHOLD * 100)}%
            confidence, not yet ticked off.
          </span>
          <button
            onClick={verifyAllHighConfidence}
            disabled={bulkBusy}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            {bulkBusy ? 'Verifying…' : `Verify all ${highConfidenceUnverified.length}`}
          </button>
        </div>
      )}

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
            <BirdEditor
              key={b.id}
              bird={b}
              active={b.id === activeId}
              onFocus={() => setActiveId(b.id)}
              onSave={save}
              onVerifyToggle={(v) => verifyToggle(b, v)}
              showConfidence
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
