import { useEffect, useRef, useState } from 'react';
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
  getCompanyDrivers,
  isLikelyPodFile,
  uploadDocumentFile,
  validateRateConDraft,
  type AppUser,
  type RateConDraft,
  type RateConStop,
  type StopDraft,
} from '@silver-crown/shared';
import ManualRateConWizard from '../components/ManualRateConWizard';
import PdfHighlightViewer from '../components/PdfHighlightViewer';
import StopAddressEditor from '../components/StopAddressEditor';
import { useAuth } from '../context/AuthContext';
import { extractRateConGemini } from '../utils/extractRateConGemini';
import { extractRateConLocal } from '../utils/extractRateConLocal';
import type { PageHighlightRect } from '../utils/manualRateConCapture';

type QueueStatus = 'queued' | 'uploading' | 'extracting' | 'ready' | 'error';
type ExtractSource = 'gemini' | 'pdf_text' | 'ocr' | 'manual';
type ImportMode = 'auto' | 'manual';

interface ImportItem {
  id: string;
  file: File;
  status: QueueStatus;
  selected: boolean;
  expanded: boolean;
  message?: string;
  draft?: RateConDraft;
  extractSource?: ExtractSource;
  documentId?: string;
  highlights?: PageHighlightRect[];
  showPdf?: boolean;
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

function extractSourceLabel(source?: ExtractSource): string {
  if (source === 'gemini') return 'Gemini';
  if (source === 'ocr') return 'OCR';
  if (source === 'pdf_text') return 'PDF text';
  if (source === 'manual') return 'Manual';
  return 'Parsed';
}

export default function ImportLoadsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [batchDriverId, setBatchDriverId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('auto');
  const [wizardItemId, setWizardItemId] = useState<string | null>(null);

  // Read inside async queue work so a mid-run change still applies.
  const batchDriverRef = useRef('');

  useEffect(() => {
    if (profile?.companyId) getCompanyDrivers(profile.companyId).then(setDrivers);
  }, [profile?.companyId]);

  const driverAssignment = (driverId: string) => ({
    assignedDriverId: driverId || null,
    assignedDriverName: drivers.find((driver) => driver.uid === driverId)?.displayName,
  });

  const patchItem = (id: string, patch: Partial<ImportItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const applyBatchDriver = (driverId: string) => {
    setBatchDriverId(driverId);
    batchDriverRef.current = driverId;
    const assignment = driverAssignment(driverId);
    setItems((current) =>
      current.map((item) =>
        item.draft ? { ...item, draft: { ...item.draft, ...assignment } } : item
      )
    );
  };

  const uploadForManual = async (item: ImportItem) => {
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
      patchItem(item.id, {
        status: 'extracting',
        documentId,
        message: 'Highlight fields on the PDF…',
      });
    } catch (error) {
      patchItem(item.id, {
        status: 'error',
        selected: false,
        message: error instanceof Error ? error.message : 'Upload failed.',
      });
      setWizardItemId((current) => (current === item.id ? null : current));
    }
  };

  const openNextManualWizard = (list: ImportItem[]) => {
    const next = list.find(
      (item) =>
        item.status === 'queued' ||
        item.status === 'error' ||
        (item.status === 'extracting' && !item.draft)
    );
    if (!next) {
      setWizardItemId(null);
      return;
    }
    setWizardItemId(next.id);
    if (next.status === 'queued' || next.status === 'error' || !next.documentId) {
      void uploadForManual(next);
    }
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
      const merged = [...current, ...next.filter((item) => !existing.has(item.id))];
      if (importMode === 'manual' && !wizardItemId) {
        queueMicrotask(() => openNextManualWizard(merged));
      }
      return merged;
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

      patchItem(item.id, { status: 'extracting', message: 'Running Gemini vision…', documentId });
      let extractedDraft: RateConDraft;
      let extractSource: ExtractSource = 'gemini';

      try {
        const geminiResult = await extractRateConGemini(item.file, {
          documentId,
          fileUrl,
          onProgress: (message) => patchItem(item.id, { message }),
        });
        extractedDraft = geminiResult.draft;
        extractSource = 'gemini';
      } catch (geminiError) {
        console.warn('Gemini extract failed, falling back to local OCR:', geminiError);
        patchItem(item.id, {
          message: 'Gemini unavailable — falling back to on-device OCR…',
        });
        const localResult = await extractRateConLocal(item.file, {
          documentId,
          onProgress: (message) => patchItem(item.id, { message }),
        });
        extractedDraft = localResult.draft;
        extractSource = localResult.source;
      }

      let draft: RateConDraft = {
        ...extractedDraft,
        sourceFile: item.file.name,
        documentId,
        ...driverAssignment(batchDriverRef.current),
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
            warnings: [
              ...(draft.warnings || []),
              'Miles calculated with Geoapify heavy_truck (loaded semi) routing.',
            ],
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

      patchItem(item.id, {
        status: 'ready',
        draft,
        extractSource,
        message: undefined,
        expanded: true,
      });
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

  const startManualForQueued = () => {
    openNextManualWizard(items);
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

  const handleManualComplete = (draft: RateConDraft, highlights: PageHighlightRect[]) => {
    if (!wizardItemId) return;
    const item = items.find((entry) => entry.id === wizardItemId);
    const documentId = item?.documentId;
    const finalDraft: RateConDraft = {
      ...draft,
      documentId: draft.documentId || documentId,
      sourceFile: draft.sourceFile || item?.file.name || draft.sourceFile,
      ...driverAssignment(batchDriverRef.current),
      assignedDriverId: draft.assignedDriverId ?? driverAssignment(batchDriverRef.current).assignedDriverId,
      assignedDriverName:
        draft.assignedDriverName || driverAssignment(batchDriverRef.current).assignedDriverName,
    };

    setItems((current) => {
      const updated = current.map((entry) =>
        entry.id === wizardItemId
          ? {
              ...entry,
              status: 'ready' as const,
              draft: finalDraft,
              extractSource: 'manual' as const,
              highlights,
              message: undefined,
              expanded: true,
              showPdf: true,
              selected: true,
            }
          : entry
      );
      queueMicrotask(() => {
        const remaining = updated.filter(
          (entry) => entry.status === 'queued' || (entry.status === 'extracting' && !entry.draft)
        );
        if (remaining.length) {
          openNextManualWizard(updated);
        } else {
          setWizardItemId(null);
        }
      });
      return updated;
    });
  };

  const handleManualCancel = () => {
    if (wizardItemId) {
      patchItem(wizardItemId, {
        status: 'error',
        selected: false,
        message: 'Manual select cancelled.',
      });
    }
    setWizardItemId(null);
  };

  const readySelected = items.filter(
    (item) => item.selected && item.draft && validateRateConDraft(item.draft).valid
  ).length;

  const wizardItem = wizardItemId ? items.find((item) => item.id === wizardItemId) : null;

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
          {importMode === 'auto'
            ? 'Upload one or many rate cons. Gemini multimodal vision extracts each file first; on-device OCR is the fallback. Review stops, rate, broker, and truck miles before creating loads.'
            : 'Upload a rate con, then highlight Broker, Load ID, Pickup, Dropoffs, and Gross Pay on the PDF. Preview with the document still visible before creating loads.'}
        </p>
      </header>

      <div className="mb-6 inline-flex border border-outline-variant">
        <button
          type="button"
          onClick={() => setImportMode('auto')}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-wider ${
            importMode === 'auto'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-low text-on-surface-variant'
          }`}
        >
          Auto extract
        </button>
        <button
          type="button"
          onClick={() => setImportMode('manual')}
          className={`px-4 py-2 text-sm font-bold uppercase tracking-wider ${
            importMode === 'manual'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-low text-on-surface-variant'
          }`}
        >
          Manual select
        </button>
      </div>

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
          {importMode === 'manual'
            ? 'Files open one at a time in the highlight wizard. Duplicate files and likely PODs are filtered.'
            : 'Select an entire batch; duplicate files and likely PODs are filtered.'}
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
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-lg">{items.length} files in batch</h2>
              <p className="text-on-surface-variant text-sm">{readySelected} reviewed and ready</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Assign whole batch to
                </span>
                <select
                  value={batchDriverId}
                  onChange={(event) => applyBatchDriver(event.target.value)}
                  className="bg-surface-container-high border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((driver) => (
                    <option key={driver.uid} value={driver.uid}>
                      {driver.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {importMode === 'auto' ? (
                <button
                  type="button"
                  disabled={
                    processing || !items.some((item) => item.status === 'queued' || item.status === 'error')
                  }
                  onClick={processQueue}
                  className="border border-primary text-primary px-4 py-2 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
                >
                  {processing ? 'Extracting…' : 'Extract batch'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    Boolean(wizardItemId) ||
                    !items.some((item) => item.status === 'queued' || item.status === 'error')
                  }
                  onClick={startManualForQueued}
                  className="border border-primary text-primary px-4 py-2 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
                >
                  Start manual select
                </button>
              )}
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
                drivers={drivers}
                patchItem={patchItem}
                updateDraft={updateDraft}
                updateStops={updateStops}
                recalculateMiles={recalculateMiles}
              />
            ))}
          </div>
        </section>
      )}

      {wizardItem && (
        <ManualRateConWizard
          file={wizardItem.file}
          documentId={wizardItem.documentId}
          drivers={drivers}
          initialDriverId={batchDriverId}
          uploading={wizardItem.status === 'uploading' || !wizardItem.documentId}
          onCancel={handleManualCancel}
          onComplete={handleManualComplete}
        />
      )}
    </div>
  );
}

function ImportRow({
  item,
  drivers,
  patchItem,
  updateDraft,
  updateStops,
  recalculateMiles,
}: {
  item: ImportItem;
  drivers: AppUser[];
  patchItem: (id: string, patch: Partial<ImportItem>) => void;
  updateDraft: (id: string, patch: Partial<RateConDraft>) => void;
  updateStops: (item: ImportItem, pickups: StopDraft[], dropoffs: StopDraft[]) => void;
  recalculateMiles: (item: ImportItem) => Promise<void>;
}) {
  const draft = item.draft;
  const validation = draft ? validateRateConDraft(draft) : null;
  const pickups = draft ? stopDrafts(draft.stops, 'pickup') : [];
  const dropoffs = draft ? stopDrafts(draft.stops, 'dropoff') : [];
  const stopCountLabel =
    dropoffs.length === 1 ? '1 stop' : `${dropoffs.length} stops`;
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
                ? `${extractSourceLabel(item.extractSource)}${
                    typeof draft.confidence === 'number'
                      ? ` ${Math.round(draft.confidence * 100)}%`
                      : ''
                  } · ${draft.broker || 'Broker needed'} · ${draft.loadRef || 'Load # needed'} · ${stopCountLabel} · ${
                    draft.assignedDriverName || 'Unassigned'
                  }`
                : item.status)}
          </p>
        </div>
        {draft && (
          <div className="hidden md:flex items-center gap-6 text-sm">
            <span className="font-semibold">{draft.payout ? `$${draft.payout.replace('$', '')}` : 'Rate needed'}</span>
            <span className="text-on-surface-variant">
              {draft.miles || '—'} mi · {draft.milesSource === 'geoapify' ? 'semi (heavy truck)' : (draft.milesSource || 'missing')}
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button
              type="button"
              onClick={() => patchItem(item.id, { showPdf: !item.showPdf })}
              className="text-primary text-xs font-bold uppercase tracking-wider"
            >
              {item.showPdf ? 'Hide PDF' : 'View PDF'}
            </button>
          </div>

          <div className={item.showPdf ? 'grid grid-cols-1 xl:grid-cols-2 gap-6' : ''}>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <Field label="Broker" value={draft.broker || ''} onChange={(broker) => updateDraft(item.id, { broker })} />
                <Field label="Load ID / Load #" value={draft.loadRef || ''} onChange={(loadRef) => updateDraft(item.id, { loadRef })} />
                <Field label="Gross / Flat rate" type="number" value={draft.payout?.replace(/[$,]/g, '') || ''} onChange={(payout) => updateDraft(item.id, { payout })} />
                <Field label="Miles" type="number" value={draft.miles || ''} onChange={(miles) => updateDraft(item.id, { miles, milesSource: 'manual' })} />
                <Field label="Weight (lbs)" value={draft.weight?.replace(/\s*lbs?/i, '') || ''} onChange={(raw) => updateDraft(item.id, { weight: raw.trim() ? `${raw.trim().replace(/,/g, '')} lbs` : undefined })} />
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
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1.5">Driver</span>
                  <select
                    value={draft.assignedDriverId || ''}
                    onChange={(event) => {
                      const assignedDriverId = event.target.value;
                      updateDraft(item.id, {
                        assignedDriverId: assignedDriverId || null,
                        assignedDriverName: drivers.find((driver) => driver.uid === assignedDriverId)
                          ?.displayName,
                      });
                    }}
                    className="w-full bg-surface-container-high border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((driver) => (
                      <option key={driver.uid} value={driver.uid}>
                        {driver.displayName}
                      </option>
                    ))}
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
                  <Route size={15} /> Recalculate semi truck miles
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

            {item.showPdf && (
              <div>
                <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-2">
                  Source document
                </p>
                <PdfHighlightViewer
                  file={item.file}
                  highlights={item.highlights || []}
                  selectionEnabled={false}
                />
              </div>
            )}
          </div>
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
