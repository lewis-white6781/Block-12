// SPEC.md section 7.7 ("Settings / More").
import { useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useStore } from '../store/useStore';
import {
  defaultPersistedState,
  downloadDailyEntriesCSV,
  downloadJSONExport,
  downloadSetsCSV,
  ImportError,
  parseImportedState,
  STORAGE_KEY,
} from '../store/persist';
import { generateDemoState } from '../dev/demoSeed';
import { convertWeight, parseWeight } from '../domain/units';
import type { WeightUnit } from '../domain/units';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  'min-h-11 w-full rounded border border-line bg-surface-2 px-3 text-base tabular-nums text-text';

function displayWeight(kg: number, unit: WeightUnit): number {
  return Number(convertWeight(kg, unit).toFixed(1));
}

export default function Settings() {
  const state = useStore();
  const { settings, updateSettings } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  function handleExportJSON() {
    downloadJSONExport(state);
  }

  function handleExportCSV() {
    downloadSetsCSV(state.sessionLogs);
  }

  function handleExportDailyCSV() {
    downloadDailyEntriesCSV(state.dailyEntries);
  }

  function handleImportClick() {
    setImportErr(null);
    setImportStatus(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseImportedState(text);
      useStore.setState(imported);
      setImportStatus(`Imported. ${Object.keys(imported.sessionLogs).length} sessions restored.`);
      setImportErr(null);
    } catch (err) {
      setImportStatus(null);
      setImportErr(err instanceof ImportError ? err.message : 'Import failed.');
    }
  }

  function handleResetConfirmed() {
    useStore.setState(defaultPersistedState());
    setConfirmingReset(false);
  }

  return (
    <div className="p-4 pb-8">
      <h1 className="font-display text-2xl text-text">More</h1>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <h2 className="text-xs uppercase tracking-wide text-muted">Block</h2>
        <div className="mt-2 space-y-3">
          <Field label="Block start date (Monday of week 1)">
            <input
              type="date"
              className={inputClass}
              value={settings.blockStartDate}
              onChange={(e) => updateSettings({ blockStartDate: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <h2 className="text-xs uppercase tracking-wide text-muted">Weight & nutrition</h2>
        <div className="mt-2">
          <Field label="Weight unit">
            <div className="flex gap-2">
              {(['kg', 'lbs'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => updateSettings({ weightUnit: u })}
                  className={`min-h-11 flex-1 rounded border text-sm uppercase ${
                    settings.weightUnit === u ? 'border-text bg-surface-2 text-text' : 'border-line text-muted'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label={`Start weight (${settings.weightUnit})`}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className={inputClass}
              value={displayWeight(settings.startWeightKg, settings.weightUnit)}
              onChange={(e) =>
                updateSettings({ startWeightKg: parseWeight(Number(e.target.value), settings.weightUnit) })
              }
            />
          </Field>
          <Field label={`Target weight (${settings.weightUnit})`}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              className={inputClass}
              value={displayWeight(settings.targetWeightKg, settings.weightUnit)}
              onChange={(e) =>
                updateSettings({ targetWeightKg: parseWeight(Number(e.target.value), settings.weightUnit) })
              }
            />
          </Field>
          <Field label="Protein target low (g)">
            <input
              type="number"
              inputMode="numeric"
              className={inputClass}
              value={settings.proteinTargetLow}
              onChange={(e) => updateSettings({ proteinTargetLow: Number(e.target.value) })}
            />
          </Field>
          <Field label="Protein target high (g)">
            <input
              type="number"
              inputMode="numeric"
              className={inputClass}
              value={settings.proteinTargetHigh}
              onChange={(e) => updateSettings({ proteinTargetHigh: Number(e.target.value) })}
            />
          </Field>
          <Field label="Carb target low (g)">
            <input
              type="number"
              inputMode="numeric"
              placeholder="optional"
              className={inputClass}
              value={settings.carbTargetLow ?? ''}
              onChange={(e) =>
                updateSettings({ carbTargetLow: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Carb target high (g)">
            <input
              type="number"
              inputMode="numeric"
              placeholder="optional"
              className={inputClass}
              value={settings.carbTargetHigh ?? ''}
              onChange={(e) =>
                updateSettings({ carbTargetHigh: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Fat target low (g)">
            <input
              type="number"
              inputMode="numeric"
              placeholder="optional"
              className={inputClass}
              value={settings.fatTargetLow ?? ''}
              onChange={(e) =>
                updateSettings({ fatTargetLow: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Fat target high (g)">
            <input
              type="number"
              inputMode="numeric"
              placeholder="optional"
              className={inputClass}
              value={settings.fatTargetHigh ?? ''}
              onChange={(e) =>
                updateSettings({ fatTargetHigh: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </Field>
        </div>
      </section>

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <h2 className="text-xs uppercase tracking-wide text-muted">Your data</h2>
        <p className="mt-1 text-xs text-muted">
          Everything lives on this device only. Export regularly — this is your backup.
        </p>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="min-h-11 w-full rounded bg-good text-base font-medium text-bg"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="min-h-11 w-full rounded border border-line text-sm text-text"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileSelected}
          />
          {importStatus && <p className="text-xs text-good">{importStatus}</p>}
          {importErr && <p className="text-xs text-bad">{importErr}</p>}
          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-11 w-full rounded border border-line text-sm text-text"
          >
            Download CSV of all sets
          </button>
          <button
            type="button"
            onClick={handleExportDailyCSV}
            className="min-h-11 w-full rounded border border-line text-sm text-text"
          >
            Download CSV of daily entries
          </button>
        </div>
      </section>

      <section className="mt-4 rounded border border-bad bg-surface p-3">
        <h2 className="text-xs uppercase tracking-wide text-muted">Danger zone</h2>
        {!confirmingReset ? (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="mt-3 min-h-11 w-full rounded border border-bad text-sm text-bad"
          >
            Reset block
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-text">
              This permanently deletes every session, entry, and setting on this device. Export
              first if you want to keep it.
            </p>
            <button
              type="button"
              onClick={handleResetConfirmed}
              className="min-h-11 w-full rounded bg-bad text-base font-medium text-bg"
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="min-h-11 w-full rounded border border-line text-sm text-text"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {import.meta.env.DEV && (
        <section className="mt-4 rounded border border-line bg-surface p-3">
          <h2 className="text-xs uppercase tracking-wide text-muted">Developer (dev build only)</h2>
          <p className="mt-1 text-xs text-muted">
            Seeds 6 weeks of plausible sessions, weights and calories so every chart has data.
            Overwrites whatever is currently on this device.
          </p>
          <button
            type="button"
            onClick={() => {
              useStore.setState(generateDemoState());
              setDemoLoaded(true);
            }}
            className="mt-3 min-h-11 w-full rounded border border-line text-sm text-text"
          >
            Load demo block
          </button>
          {demoLoaded && <p className="mt-2 text-xs text-good">Demo block loaded.</p>}
        </section>
      )}

      <section className="mt-4 rounded border border-line bg-surface p-3">
        <h2 className="text-xs uppercase tracking-wide text-muted">About</h2>
        <p className="mt-2 text-sm text-text">BLOCK 12</p>
        <p className="mt-1 text-xs text-muted">
          A fixed 12-week calisthenics and cut block. Offline-first, single-user, no account, no
          server. All data stored locally under <code>{STORAGE_KEY}</code>.
        </p>
      </section>
    </div>
  );
}
