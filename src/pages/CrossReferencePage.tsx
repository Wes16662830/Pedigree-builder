import { useEffect, useState } from 'react';
import { getAllBirds, getCrossReference, getInbreeding } from '../lib/api';
import type { Bird, CrossReferenceReport, InbreedingResult } from '../../shared/types';

export default function CrossReferencePage() {
  const [report, setReport] = useState<CrossReferenceReport>();
  const [birds, setBirds] = useState<Bird[]>([]);
  const [selectedBirdId, setSelectedBirdId] = useState<string>('');
  const [inbreeding, setInbreeding] = useState<InbreedingResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([getCrossReference(), getAllBirds()])
      .then(([r, b]) => {
        setReport(r);
        const withParents = b.filter((bird) => bird.sireId && bird.damId).sort((a, c) => a.ring.localeCompare(c.ring));
        setBirds(withParents);
        if (withParents[0]) setSelectedBirdId(withParents[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  useEffect(() => {
    if (!selectedBirdId) return;
    getInbreeding(selectedBirdId).then(setInbreeding).catch(() => setInbreeding(undefined));
  }, [selectedBirdId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!report) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Cross-reference</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every ancestor from every upload lives in one database — matched by ring across the whole collection. This is what stops a bad pairing before it
          happens.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Wright's coefficient of inbreeding</h2>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <select className="mb-3 rounded border px-2 py-1.5 text-sm" value={selectedBirdId} onChange={(e) => setSelectedBirdId(e.target.value)}>
            {birds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.ring} {b.name ? `"${b.name}"` : ''}
              </option>
            ))}
          </select>
          {inbreeding && (
            <div>
              <div className="text-2xl font-bold">{(inbreeding.coefficient * 100).toFixed(2)}%</div>
              {inbreeding.contributingAncestors.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-neutral-600">
                  {inbreeding.contributingAncestors.map((c, i) => (
                    <li key={i}>
                      {c.ancestorRing} — contributes {(c.contribution * 100).toFixed(2)}%
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">No common ancestors between sire and dam sides found in the data on hand.</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Shared ancestors ({report.sharedAncestors.length})</h2>
        <p className="mb-2 text-xs text-neutral-500">The same physical ancestor appearing in more than one uploaded pedigree.</p>
        <div className="space-y-2">
          {report.sharedAncestors.map((m) => (
            <div key={m.ancestorId} className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <div className="font-semibold">
                {m.ancestorRing} {m.ancestorName && `"${m.ancestorName}"`}
              </div>
              <ul className="mt-1 text-neutral-600">
                {m.foundIn.map((f, i) => (
                  <li key={i}>
                    {f.birdRing} — {f.sourceFile}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {report.sharedAncestors.length === 0 && <p className="text-sm text-neutral-500">None found yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Line-breeding ({report.lineBreeding.length})</h2>
        <p className="mb-2 text-xs text-neutral-500">One ancestor appearing more than once within a single bird's own pedigree.</p>
        <div className="space-y-2">
          {report.lineBreeding.map((m, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <span className="font-semibold">{m.ancestorRing}</span> {m.ancestorName && `"${m.ancestorName}"`} sits{' '}
              <span className="font-mono">{m.notation}</span> in <span className="font-mono">{m.birdId}</span>
            </div>
          ))}
          {report.lineBreeding.length === 0 && <p className="text-sm text-neutral-500">None found yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Sibling relationships across sheets ({report.siblings.length})</h2>
        <div className="space-y-2">
          {report.siblings.map((s, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
              <span className="font-mono">{s.birdAId}</span> and <span className="font-mono">{s.birdBId}</span> — {s.relationship}
            </div>
          ))}
          {report.siblings.length === 0 && <p className="text-sm text-neutral-500">None found yet.</p>}
        </div>
      </section>
    </div>
  );
}
