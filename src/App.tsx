import { useState } from 'react';
import type { ExtractResponse } from './lib/api';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import VerifyPage from './pages/VerifyPage';
import MergePage from './pages/MergePage';
import SheetPage from './pages/SheetPage';
import CrossReferencePage from './pages/CrossReferencePage';
import SettingsPage from './pages/SettingsPage';

export type ParentSide = 'sire' | 'dam';

export interface ParentUploadState {
  uploadId: string;
  fileUrl: string;
  extracted: ExtractResponse['extracted'];
  verified: boolean;
}

type View =
  | { name: 'home' }
  | { name: 'upload' }
  | { name: 'verify'; side: ParentSide }
  | { name: 'merge' }
  | { name: 'sheet'; childPedigreeId: string }
  | { name: 'crossref' }
  | { name: 'settings' };

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const [sire, setSire] = useState<ParentUploadState | undefined>();
  const [dam, setDam] = useState<ParentUploadState | undefined>();

  function reset() {
    setSire(undefined);
    setDam(undefined);
    setView({ name: 'home' });
  }

  function onExtracted(side: ParentSide, res: ExtractResponse) {
    const state: ParentUploadState = { uploadId: res.uploadId, fileUrl: res.fileUrl, extracted: res.extracted, verified: false };
    if (side === 'sire') setSire(state);
    else setDam(state);
  }

  function onVerified(side: ParentSide) {
    if (side === 'sire') setSire((s) => (s ? { ...s, verified: true } : s));
    else setDam((d) => (d ? { ...d, verified: true } : d));
  }

  const bothReady = !!sire?.verified && !!dam?.verified;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="no-print border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <button className="flex items-center gap-2 font-semibold tracking-tight" onClick={reset}>
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#D19A45' }} />
            OudeLuck Pedigree Builder
          </button>
          <nav className="flex gap-4 text-sm">
            <button className="hover:underline" onClick={() => setView({ name: 'home' })}>
              Pedigrees
            </button>
            <button className="hover:underline" onClick={() => setView({ name: 'upload' })}>
              New Pedigree
            </button>
            <button className="hover:underline" onClick={() => setView({ name: 'crossref' })}>
              Cross-reference
            </button>
            <button className="hover:underline" onClick={() => setView({ name: 'settings' })}>
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {view.name === 'home' && (
          <HomePage
            onNew={() => {
              setSire(undefined);
              setDam(undefined);
              setView({ name: 'upload' });
            }}
            onOpen={(childPedigreeId) => setView({ name: 'sheet', childPedigreeId })}
          />
        )}

        {view.name === 'upload' && (
          <UploadPage
            sire={sire}
            dam={dam}
            onExtracted={onExtracted}
            onVerify={(side) => setView({ name: 'verify', side })}
            onContinueToMerge={() => setView({ name: 'merge' })}
          />
        )}

        {view.name === 'verify' && (sire || dam) && (
          <VerifyPage
            side={view.side}
            state={view.side === 'sire' ? sire : dam}
            onDone={() => {
              onVerified(view.side);
              setView({ name: 'upload' });
            }}
            onCancel={() => setView({ name: 'upload' })}
          />
        )}

        {view.name === 'merge' && bothReady && sire && dam && (
          <MergePage sire={sire} dam={dam} onMerged={(childPedigreeId) => setView({ name: 'sheet', childPedigreeId })} />
        )}

        {view.name === 'sheet' && <SheetPage childPedigreeId={view.childPedigreeId} onBack={() => setView({ name: 'home' })} />}

        {view.name === 'crossref' && <CrossReferencePage />}

        {view.name === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
