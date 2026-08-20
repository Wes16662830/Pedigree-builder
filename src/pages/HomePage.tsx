import { useEffect, useState } from 'react';
import { listChildPedigrees } from '../lib/api';

interface Props {
  onNew: () => void;
  onOpen: (childPedigreeId: string) => void;
}

export default function HomePage({ onNew, onOpen }: Props) {
  const [rows, setRows] = useState<{ id: string; child_bird_id: string; created_at: string }[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    listChildPedigrees().then(setRows).catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedigrees</h1>
          <p className="mt-1 text-sm text-neutral-500">OudeLuck Lofts (OneLoft Genetics) — upload two parent pedigrees, verify, and produce a branded child sheet.</p>
        </div>
        <button onClick={onNew} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: '#111111' }}>
          + New Pedigree
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          No pedigrees yet. Seed the database (<code>npm run db:seed</code>) or start a new upload.
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50">
                <span className="font-mono text-sm">{r.child_bird_id}</span>
                <span className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
