import { useEffect, useState } from 'react';
import { clearApiKey, getSettings, saveApiKey, type SettingsInfo } from '../lib/api';

export default function SettingsPage() {
  const [info, setInfo] = useState<SettingsInfo>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [savedJustNow, setSavedJustNow] = useState(false);

  function load() {
    getSettings()
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'));
  }

  useEffect(load, []);

  async function save() {
    if (!input.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const updated = await saveApiKey(input.trim());
      setInfo(updated);
      setInput('');
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save key');
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(undefined);
    try {
      setInfo(await clearApiKey());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear key');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Your Anthropic API key, used for pedigree extraction and prose generation. It's stored server-side and never sent to any browser other than
        yours — this page only ever shows the last few characters back to you.
      </p>

      {info && (
        <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
          {info.hasApiKey ? (
            <p>
              <span className="text-green-600">●</span> API key configured
              {info.apiKeyPreview && (
                <>
                  {' '}
                  (<span className="font-mono">{info.apiKeyPreview}</span>)
                </>
              )}
              {info.source === 'env' && <span className="text-neutral-500"> — from the server's environment, not yet overridden here</span>}
            </p>
          ) : (
            <p>
              <span className="text-red-600">●</span> No API key configured yet. Extraction and prose generation will fail until one is set below.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
        <label className="block">
          <span className="block text-xs text-neutral-500">Anthropic API key</span>
          <input
            type="password"
            autoComplete="off"
            className="w-full rounded border px-2 py-1.5 font-mono"
            placeholder="sk-ant-..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy || !input.trim()}
            className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: '#111111' }}
          >
            {busy ? 'Saving…' : 'Save key'}
          </button>
          {info?.source === 'settings' && (
            <button onClick={clear} disabled={busy} className="rounded-md border px-3 py-2 text-sm disabled:opacity-40">
              Remove saved key
            </button>
          )}
          {savedJustNow && <span className="text-sm text-green-600">Saved.</span>}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-6 text-xs text-neutral-400">
        Get a key at{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline">
          console.anthropic.com/settings/keys
        </a>
        .
      </p>
    </div>
  );
}
