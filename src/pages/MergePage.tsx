import { useState } from 'react';
import type { Sex } from '../../shared/types';
import { mergePedigrees } from '../lib/api';
import type { ParentState } from '../App';
import { rootIdOf, uploadIdOf } from '../App';

interface Props {
  sire: ParentState;
  dam: ParentState;
  onMerged: (childPedigreeId: string) => void;
}

export default function MergePage({ sire, dam, onMerged }: Props) {
  const [ring, setRing] = useState('');
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('unknown');
  const [colour, setColour] = useState('');
  const [breeder, setBreeder] = useState('OudeLuck Lofts');
  const [loftAddress, setLoftAddress] = useState('Athlone Farm, Tarkastad, Eastern Cape');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    if (!ring.trim()) {
      setError('Ring is required.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const result = await mergePedigrees({
        sire: { rootId: rootIdOf(sire), uploadId: uploadIdOf(sire) },
        dam: { rootId: rootIdOf(dam), uploadId: uploadIdOf(dam) },
        child: { ring: ring.trim(), name: name || undefined, sex, colour: colour || undefined, breeder: breeder || undefined, loftAddress: loftAddress || undefined },
      });
      onMerged(result.childPedigreeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold">Merge into child</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Both parent pedigrees are verified. Enter the child's own details — the tree is assembled mechanically, then one call writes the prose sections
        grounded in the verified tree.
      </p>

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
        <label className="block">
          <span className="block text-xs text-neutral-500">Ring (verbatim, this loft's own convention)</span>
          <input className="w-full rounded border px-2 py-1.5 font-mono" placeholder="ZA 2805 BORD 2026" value={ring} onChange={(e) => setRing(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500">Name</span>
          <input className="w-full rounded border px-2 py-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500">Sex</span>
          <select className="w-full rounded border px-2 py-1.5" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="unknown">unknown</option>
            <option value="cock">cock</option>
            <option value="hen">hen</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500">Colour</span>
          <input className="w-full rounded border px-2 py-1.5" value={colour} onChange={(e) => setColour(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500">Breeder</span>
          <input className="w-full rounded border px-2 py-1.5" value={breeder} onChange={(e) => setBreeder(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-500">Loft address</span>
          <input className="w-full rounded border px-2 py-1.5" value={loftAddress} onChange={(e) => setLoftAddress(e.target.value)} />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: '#111111' }}
        >
          {busy ? 'Merging…' : 'Merge and generate prose →'}
        </button>
      </div>
    </div>
  );
}
