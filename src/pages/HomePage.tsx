import { useEffect, useState } from 'react';
import {
  createFolder,
  deleteChildPedigree,
  deleteFolder,
  getAllBirds,
  getFolders,
  listChildPedigrees,
  moveChildPedigreeToFolder,
  type ChildPedigreeListRow,
  type Folder,
} from '../lib/api';
import type { Bird } from '../../shared/types';

interface Props {
  onNew: () => void;
  onOpen: (childPedigreeId: string) => void;
}

const UNFILED = '__unfiled__';
const ALL = '__all__';

export default function HomePage({ onNew, onOpen }: Props) {
  const [rows, setRows] = useState<ChildPedigreeListRow[]>();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [birds, setBirds] = useState<Map<string, Bird>>(new Map());
  const [error, setError] = useState<string>();
  const [activeFolder, setActiveFolder] = useState<string>(ALL);
  const [newFolderName, setNewFolderName] = useState('');

  function load() {
    Promise.all([listChildPedigrees(), getFolders(), getAllBirds()])
      .then(([r, f, b]) => {
        setRows(r);
        setFolders(f);
        setBirds(new Map(b.map((bird) => [bird.id, bird])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }

  useEffect(load, []);

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Delete the pedigree sheet for ${label}? The bird itself and its ancestor data stay on file — only this generated sheet is removed.`)) {
      return;
    }
    try {
      await deleteChildPedigree(id);
      setRows((prev) => prev?.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleMove(id: string, folderId: string) {
    const value = folderId === UNFILED ? null : folderId;
    try {
      await moveChildPedigreeToFolder(id, value);
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, folder_id: value } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Move failed');
    }
  }

  async function handleNewFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const folder = await createFolder(name);
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create folder');
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    if (!window.confirm(`Delete folder "${folder.name}"? Pedigrees inside it move back to Unfiled — nothing is deleted.`)) return;
    try {
      await deleteFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setRows((prev) => prev?.map((r) => (r.folder_id === folder.id ? { ...r, folder_id: null } : r)));
      if (activeFolder === folder.id) setActiveFolder(ALL);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete folder');
    }
  }

  const visible = rows?.filter((r) => {
    if (activeFolder === ALL) return true;
    if (activeFolder === UNFILED) return !r.folder_id;
    return r.folder_id === activeFolder;
  });

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

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveFolder(ALL)}
          className={`rounded-full px-3 py-1 text-xs ${activeFolder === ALL ? 'bg-neutral-900 text-white' : 'border border-neutral-300 text-neutral-600'}`}
        >
          All
        </button>
        <button
          onClick={() => setActiveFolder(UNFILED)}
          className={`rounded-full px-3 py-1 text-xs ${activeFolder === UNFILED ? 'bg-neutral-900 text-white' : 'border border-neutral-300 text-neutral-600'}`}
        >
          Unfiled
        </button>
        {folders.map((f) => (
          <span key={f.id} className="group inline-flex items-center gap-1">
            <button
              onClick={() => setActiveFolder(f.id)}
              className={`rounded-full px-3 py-1 text-xs ${activeFolder === f.id ? 'bg-neutral-900 text-white' : 'border border-neutral-300 text-neutral-600'}`}
            >
              {f.name}
            </button>
            <button onClick={() => handleDeleteFolder(f)} title="Delete folder" className="hidden text-xs text-neutral-400 hover:text-red-600 group-hover:inline">
              ✕
            </button>
          </span>
        ))}
        <span className="ml-2 flex items-center gap-1">
          <input
            className="w-32 rounded border px-2 py-1 text-xs"
            placeholder="New folder…"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
          />
          <button onClick={handleNewFolder} className="rounded border px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50">
            Add
          </button>
        </span>
      </div>

      {visible && visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          {rows && rows.length === 0 ? (
            <>
              No pedigrees yet. Seed the database (<code>npm run db:seed</code>) or start a new upload.
            </>
          ) : (
            'Nothing in this folder yet.'
          )}
        </div>
      )}

      {visible && visible.length > 0 && (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {visible.map((r) => {
            const bird = birds.get(r.child_bird_id);
            const label = bird ? `${bird.ring}${bird.name ? ` "${bird.name}"` : ''}` : r.child_bird_id;
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => onOpen(r.id)} className="flex-1 text-left hover:underline">
                  <span className="font-mono text-sm">{label}</span>
                </button>
                <span className="text-xs text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</span>
                <select
                  value={r.folder_id ?? UNFILED}
                  onChange={(e) => handleMove(r.id, e.target.value)}
                  className="rounded border px-1.5 py-1 text-xs text-neutral-600"
                >
                  <option value={UNFILED}>Unfiled</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => handleDelete(r.id, label)} className="text-xs text-neutral-400 hover:text-red-600">
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
