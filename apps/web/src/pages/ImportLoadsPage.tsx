import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  MapPin,
  Route,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  calculateRateConRouteMiles,
  createDocumentRecord,
  createLoadsFromDrafts,
  createStopDraftFromStop,
  draftsToStops,
  isLikelyPodFile,
  uploadDocumentFile,
  validateRateConDraft,
  type RateConDraft,
  type RateConStop,
  type StopDraft,
} from '@silver-crown/shared';
import StopAddressEditor from '../components/StopAddressEditor';
import { useAuth } from '../context/AuthContext';
import { extractRateConLocal } from '../utils/extractRateConLocal';

type QueueStatus = 'queued' | 'uploading' | 'extracting' | 'ready' | 'error';

interface ImportItem {
  id: string;
  file: File;
  status: QueueStatus;
  selected: boolean;
  expanded: boolean;
  message?: string;
  draft?: RateConDraft;
}

const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function stopDrafts(stops: RateConStop[], type: RateConStop['type']): StopDraft[] {
  const filtered = stops
    .filter((stop) => stop.type === type)
    .sort((a, b) => a.sequence - b.sequence);
  if (filtered.length === 0) return [{ query: '', stop: null }];
  return filtered.map((stop) =>
    stop.coords
      ? createStopDraftFromStop({ ...stop, coords: stop.coords })
      : { query: stop.address, stop: null }
  );
}

export default function ImportLoadsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');

  const patchItem = (id: string, patch: Partial<ImportItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addFiles = (files: File[]) => {
    const next: ImportItem[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (!acceptedTypes.includes(file.type) && !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
        rejected.push(`${file.name}: unsupported file`);
        continue;
      }
      if (isLikelyPodFile(file.name)) {
        rejected.push(`${file.name}: looks like a POD/CamScanner file`);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        status: 'queued',
        selected: true,
        expanded: false,
      });
    }

    setItems((current) => {
      const existing = new Set(current.map((item) => item.id));
      return [...current, ...next.filter((item) => !existing.has(item.id))];
    });
    setNotice(rejected.join(' · '));
  };

  const processOne = async (item: ImportItem) => {
    if (!profile?.companyId || !profile.uid) return;
    try {
      patchItem(item.id, { status: 'uploading', message: 'Uploading secure copy…' });
      const storageKey = `ratecon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fileUrl = await uploadDocumentFile(
        profile.companyId,
        storageKey,
        item.file,
        item.file.name
      );
      const documentId = await createDocumentRecord({
        companyId: profile.companyId,
        uploadedBy: profile.uid,
        uploaderName: profile.displayName || 'Admin',
        fileName: item.file.name,
        fileUrl,
        fileType: item.file.type || 'application/pdf',
        docType: 'rate_confirmation',
        status: 'processing',
      });

      patchItem(item.id, { status: 'extracting', message: 'Reading rate confirmation…' });
      const { draft: extractedDraft } = await extractRateConLocal(item.file, {
        documentId,
        onProgress: (message) => patchItem(item.id, { message }),
      });

      let draft: RateConDraft = {
        ...extractedDraft,
        sourceFile: item.file.name,
        documentId,
      };
      if (!draft.miles && draft.stops.length >= 2) {
        patchItem(item.id, { message: 'Calculating truck route miles…' });
        try {
          const route = await calculateRateConRouteMiles(draft.stops);
          draft = {
            ...draft,
            miles: String(route.miles),
            milesSource: 'geoapify',
            stops: route.stops,
            warnings: [...(draft.warnings || []), 'Miles calculated with Geoapify truck routing.'],
          };
        } catch (error) {
          draft = {
            ...draft,
            warnings: [
              ...(draft.warnings || []),
              error instanceof Error ? error.message : 'Route miles need review.',
            ],
          };
        }
      }

      patchItem(item.id, { status: 'ready', draft, message: undefined, expanded: true });
    } catch (error) {
      patchItem(item.id, {
        status: 'error',
        selected: false,
        message: error instanceof Error ? error.message : 'Import failed.',
      });
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    setNotice('');
    const queued = items.filter((item) => item.status === 'queued' || item.status === 'error');
    for (const item of queued) await processOne(item);
    setProcessing(false);
  };

  const updateDraft = (id: string, patch: Partial<RateConDraft>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id && item.draft ? { ...item, draft: { ...item.draft, ...patch } } : item
      )
    );
  };

  const updateStops = (
    item: ImportItem,
    pickups: StopDraft[],
    dropoffs: StopDraft[]
  ) => {
    if (!item.draft) return;
    const completeStops = draftsToStops(pickups, dropoffs);
    if (completeStops) {
      updateDraft(item.id, { stops: completeStops, milesSource: 'manual' });
      return;
    }
    const partial: RateConStop[] = [
      ...pickups.map((entry, sequence) => ({
        type: 'pickup' as const,
        address: entry.query,
        coords: entry.stop?.coords,
        sequence,
      })),
      ...dropoffs.map((entry, sequence) => ({
        type: 'dropoff' as const,
        address: entry.query,
        coords: entry.stop?.coords,
        sequence,
      })),
    ];
    updateDraft(item.id, { stops: partial, milesSource: 'manual' });
  };

  const recalculateMiles = async (item: ImportItem) => {
    if (!item.draft) return;
    patchItem(item.id, { status: 'extracting', message: 'Recalculating truck route…' });
    try {
      const route = await calculateRateConRouteMiles(item.draft.stops);
      updateDraft(item.id, {
        miles: String(route.miles),
        milesSource: 'geoapify',
        stops: route.stops,
      });
      patchItem(item.id, { status: 'ready', message: undefined });
    } catch (error) {
      patchItem(item.id, {
        status: 'ready',
        message: error instanceof Error ? error.message : 'Route calculation failed.',
      });
    }
  };

  const createSelected = async () => {
    if (!profile?.companyId) return;
    const selected = items
      .filter((item) => item.selected && item.draft)
      .map((item) => item.draft!);
    setCreating(true);
    const result = await createLoadsFromDrafts(profile.companyId, selected);
    setCreating(false);
    if (result.skipped.length) {
      setNotice(
        `${result.created.length} created; ${result.skipped.length} skipped: ${result.skipped
          .map((entry) => entry.reason)
          .join(' · ')}`
      );
      return;
    }
    navigate('/loads', { state: { importCount: result.created.length } });
  };

  const readySelected = items.filter(
    (item) => item.selected && item.draft && validateRateConDraft(item.draft).valid
  ).length;

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <p className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-2">
          Dispatch intake
        </p>
        <h1 className="font-[family-name:var(--font-bebas)] text-5xl tracking-wider">
          IMPORT RATE CONFIRMATIONS
        </h1>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          Upload one or many rate cons. Review the stops, rate, broker, and truck miles before
          creating loads.
        </p>
      </header>

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
        className={`border-2 border-dashed px-8 py-10 text-center transition-colors ${
          dragging ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface-container-low'
        }`}
      >
        <UploadCloud className="mx-auto text-primary mb-3" size={32} />
        <h2 className="font-semibold">Drop rate confirmation PDFs or images here</h2>
        <p className="text-on-surface-variant text-sm mt-1 mb-5">
          Select an entire batch; duplicate files and likely PODs are filtered.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="bg-primary text-on-primary px-5 py-2.5 font-bold text-sm uppercase tracking-wider hover:opacity-90"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          hidden
          multiple
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={(event) => addFiles(Array.from(event.target.files || []))}
        />
      </section>

      {notice && (
        <div className="mt-4 border border-error/40 bg-error-container/20 text-error px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      {items.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-lg">{items.length} files in batch</h2>
              <p className="text-on-surface-variant text-sm">{readySelected} reviewed and ready</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={processing || !items.some((item) => item.status === 'queued' || item.status === 'error')}
                onClick={processQueue}
                className="border border-primary text-primary px-4 py-2 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
              >
                {processing ? 'Extracting…' : 'Extract batch'}
              </button>
              <button
                type="button"
                disabled={creating || readySelected === 0}
                onClick={createSelected}
                className="bg-primary text-on-primary px-4 py-2 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
              >
                {creating ? 'Creating…' : `Create ${readySelected} loads`}
              </button>
            </div>
          </div>

          <div className="border border-outline-variant divide-y divide-outline-variant">
            {items.map((item) => (
              <ImportRow
                key={item.id}
                item={item}
                patchItem={patchItem}
                updateDraft={updateDraft}
                updateStops={updateStops}
                recalculateMiles={recalculateMiles}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ImportRow({
  item,
  patchItem,
  updateDraft,
  updateStops,
  recalculateMiles,
}: {
  item: ImportItem;
  patchItem: (id: string, patch: Partial<ImportItem>) => void;
  updateDraft: (id: string, patch: Partial<RateConDraft>) => void;
  updateStops: (item: ImportItem, pickups: StopDraft[], dropoffs: StopDraft[]) => void;
  recalculateMiles: (item: ImportItem) => Promise<void>;
}) {
  const draft = item.draft;
  const validation = draft ? validateRateConDraft(draft) : null;
  const pickups = draft ? stopDrafts(draft.stops, 'pickup') : [];
  const dropoffs = draft ? stopDrafts(draft.stops, 'dropoff') : [];
  const statusIcon = item.status === 'ready'
    ? validation?.valid
      ? <CheckCircle2 className="text-primary" size={18} />
      : <AlertTriangle className="text-error" size={18} />
    : item.status === 'error'
      ? <AlertTriangle className="text-error" size={18} />
      : item.status === 'queued'
        ? <FileText className="text-on-surface-variant" size={18} />
        : <Loader2 className="text-primary animate-spin" size={18} />;

  return (
    <article className="bg-surface-container-low">
      <div className="flex items-center gap-4 p-4">
        <input
          type="checkbox"
          checked={item.selected}
          disabled={!draft}
          onChange={(event) => patchItem(item.id, { selected: event.target.checked })}
          className="accent-[var(--color-primary)]"
        />
        {statusIcon}
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{item.file.name}</p>
          <p className="text-on-surface-variant text-xs mt-1">
            {item.message ||
              (draft
                ? `${draft.broker || 'Broker needed'} · ${draft.loadRef || 'Load # needed'} · ${draft.stops.length} stops`
                : item.status)}
          </p>
        </div>
        {draft && (
          <div className="hidden md:flex items-center gap-6 text-sm">
            <span className="font-semibold">{draft.payout ? `$${draft.payout.replace('$', '')}` : 'Rate needed'}</span>
            <span className="text-on-surface-variant">
              {draft.miles || '—'} mi · {draft.milesSource || 'missing'}
            </span>
          </div>
        )}
        <button
          type="button"
          aria-label={item.expanded ? 'Collapse rate confirmation' : 'Review rate confirmation'}
          disabled={!draft}
          onClick={() => patchItem(item.id, { expanded: !item.expanded })}
          className="p-2 text-on-surface-variant disabled:opacity-30"
        >
          {item.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <button
          type="button"
          aria-label="Remove file"
          onClick={() => patchItem(item.id, { selected: false, status: 'error', message: 'Removed from import.' })}
          className="p-2 text-on-surface-variant hover:text-error"
        >
          <X size={18} />
        </button>
      </div>

      {item.expanded && draft && (
        <div className="border-t border-outline-variant p-5 bg-surface-container">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <Field label="Broker" value={draft.broker || ''} onChange={(broker) => updateDraft(item.id, { broker })} />
            <Field label="Load ID / Load #" value={draft.loadRef || ''} onChange={(loadRef) => updateDraft(item.id, { loadRef })} />
            <Field label="Gross / Flat rate" type="number" value={draft.payout?.replace(/[$,]/g, '') || ''} onChange={(payout) => updateDraft(item.id, { payout })} />
            <Field label="Miles" type="number" value={draft.miles || ''} onChange={(miles) => updateDraft(item.id, { miles, milesSource: 'manual' })} />
            <Field label="Line haul" type="number" value={draft.lineHaul?.replace(/[$,]/g, '') || ''} onChange={(lineHaul) => updateDraft(item.id, { lineHaul })} />
            <Field label="Accessorials" type="number" value={draft.accessorials?.replace(/[$,]/g, '') || ''} onChange={(accessorials) => updateDraft(item.id, { accessorials })} />
            <Field label="Accessorial detail" value={draft.accessorialDetail || ''} onChange={(accessorialDetail) => updateDraft(item.id, { accessorialDetail })} />
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1.5">Equipment</span>
              <select
                value={draft.type || 'Dry Van'}
                onChange={(event) => updateDraft(item.id, { type: event.target.value as RateConDraft['type'] })}
                className="w-full bg-surface-container-high border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option>Dry Van</option>
                <option>Reefer</option>
                <option>Flatbed</option>
              </select>
            </label>
            <Field label="Dispatch date" type="date" value={draft.dispatchDate || ''} onChange={(dispatchDate) => updateDraft(item.id, { dispatchDate })} />
            <Field label="Pickup date" type="date" value={draft.pickupDate || ''} onChange={(pickupDate) => updateDraft(item.id, { pickupDate })} />
            <Field label="Delivery date" type="date" value={draft.deliveryDate || ''} onChange={(deliveryDate) => updateDraft(item.id, { deliveryDate })} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="text-primary" size={18} />
              <h3 className="font-semibold">Ordered route</h3>
            </div>
            <button
              type="button"
              onClick={() => recalculateMiles(item)}
              className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider"
            >
              <Route size={15} /> Recalculate truck miles
            </button>
          </div>
          <StopAddressEditor
            pickups={pickups}
            dropoffs={dropoffs}
            onPickupsChange={(next) => updateStops(item, next, dropoffs)}
            onDropoffsChange={(next) => updateStops(item, pickups, next)}
          />

          {(draft.warnings?.length || !validation?.valid) && (
            <div className="mt-5 border-l-2 border-error pl-3 text-sm text-on-surface-variant">
              {[...(draft.warnings || []), ...(validation?.errors || [])].map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-surface-container-high border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
