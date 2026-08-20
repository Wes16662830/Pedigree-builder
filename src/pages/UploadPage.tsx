import { useRef, useState } from 'react';
import { extractPedigreeFile } from '../lib/api';
import type { ExtractResponse } from '../lib/api';
import type { ParentSide, ParentUploadState } from '../App';

interface Props {
  sire?: ParentUploadState;
  dam?: ParentUploadState;
  onExtracted: (side: ParentSide, res: ExtractResponse) => void;
  onVerify: (side: ParentSide) => void;
  onContinueToMerge: () => void;
}

function Dropzone({
  side,
  state,
  onExtracted,
  onVerify,
}: {
  side: ParentSide;
  state?: ParentUploadState;
  onExtracted: (side: ParentSide, res: ExtractResponse) => void;
  onVerify: (side: ParentSide) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await extractPedigreeFile(file);
      onExtracted(side, res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-1 font-semibold capitalize">{side}'s pedigree</h3>
      <p className="mb-3 text-xs text-neutral-500">Any loft, any format — image or PDF. One vision extraction call per upload.</p>

      {!state && (
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

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {state && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm">
            <span>{state.extracted.birds.length} birds extracted from {state.extracted.sourceFile}</span>
            <span className={state.verified ? 'text-green-600' : 'text-amber-600'}>{state.verified ? 'Verified' : 'Needs verification'}</span>
          </div>
          {state.extracted.extractionNotes && <p className="text-xs italic text-neutral-500">Model note: {state.extracted.extractionNotes}</p>}
          {!state.verified && (
            <button onClick={() => onVerify(side)} className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600">
              Open verification screen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadPage({ sire, dam, onExtracted, onVerify, onContinueToMerge }: Props) {
  const bothReady = !!sire?.verified && !!dam?.verified;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">New pedigree</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Upload both parents' pedigrees. Each gets one vision extraction call, then must pass verification before anything else can happen — nothing renders on
        unverified data.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Dropzone side="sire" state={sire} onExtracted={onExtracted} onVerify={onVerify} />
        <Dropzone side="dam" state={dam} onExtracted={onExtracted} onVerify={onVerify} />
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
