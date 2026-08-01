import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Route,
  X,
} from 'lucide-react';
import {
  resolveRateConDraftForCreate,
  validateRateConDraft,
  type AppUser,
  type RateConDraft,
  type RateConStop,
} from '@silver-crown/shared';
import PdfHighlightViewer, { type SelectionResult } from './PdfHighlightViewer';
import StopAddressTextFields from './StopAddressTextFields';
import {
  MANUAL_CAPTURE_STEPS,
  buildDraftFromManualCaptures,
  cleanAddress,
  cleanBroker,
  cleanLoadRef,
  cleanPayout,
  emptyManualCaptures,
  type ManualCaptures,
  type ManualFieldKey,
  type PageHighlightRect,
} from '../utils/manualRateConCapture';

type WizardPhase = 'capture' | 'preview';

interface ManualRateConWizardProps {
  file: File;
  documentId?: string;
  drivers: AppUser[];
  initialDriverId?: string;
  uploading?: boolean;
  onCancel: () => void;
  onComplete: (draft: RateConDraft, highlights: PageHighlightRect[]) => void;
}

function stopAddresses(stops: RateConStop[], type: RateConStop['type']): string[] {
  const filtered = stops
    .filter((stop) => stop.type === type)
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => stop.address);
  return filtered.length > 0 ? filtered : [''];
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
      <span className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-surface-container-high border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function applyCleaner(key: ManualFieldKey, raw: string): string {
  if (key === 'broker') return cleanBroker(raw);
  if (key === 'loadRef') return cleanLoadRef(raw);
  if (key === 'pickup' || key === 'dropoff') return cleanAddress(raw);
  return cleanPayout(raw);
}

function withHighlight(
  captures: ManualCaptures,
  stepKey: ManualFieldKey,
  label: string,
  color: string,
  rect: SelectionResult['rect'] | null
): ManualCaptures {
  if (!rect) return captures;
  const highlight: PageHighlightRect = {
    ...rect,
    fieldKey: stepKey,
    instanceId: `${stepKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    color,
  };
  return { ...captures, highlights: [...captures.highlights, highlight] };
}

export default function ManualRateConWizard({
  file,
  documentId,
  drivers,
  initialDriverId = '',
  uploading = false,
  onCancel,
  onComplete,
}: ManualRateConWizardProps) {
  const [phase, setPhase] = useState<WizardPhase>('capture');
  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<ManualCaptures>(emptyManualCaptures);
  const [pendingText, setPendingText] = useState('');
  const [pendingRect, setPendingRect] = useState<SelectionResult['rect'] | null>(null);
  const [ocrNote, setOcrNote] = useState('');
  const [draft, setDraft] = useState<RateConDraft | null>(null);
  const [calculatingMiles, setCalculatingMiles] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    setDraft((current) =>
      current && current.documentId !== documentId
        ? { ...current, documentId }
        : current
    );
  }, [documentId]);

  const step = MANUAL_CAPTURE_STEPS[stepIndex];
  const isDropoffStep = step.key === 'dropoff';

  const stepStatus = useMemo(() => {
    return MANUAL_CAPTURE_STEPS.map((s) => {
      if (s.key === 'broker') return Boolean(captures.broker);
      if (s.key === 'loadRef') return Boolean(captures.loadRef);
      if (s.key === 'pickup') return Boolean(captures.pickup);
      if (s.key === 'dropoff') return captures.dropoffs.length > 0;
      if (s.key === 'payout') return Boolean(captures.payout);
      return false;
    });
  }, [captures]);

  const openPreview = (finalCaptures: ManualCaptures) => {
    const driver = drivers.find((d) => d.uid === initialDriverId);
    const nextDraft = buildDraftFromManualCaptures(finalCaptures, {
      sourceFile: file.name,
      documentId,
      assignedDriverId: initialDriverId || null,
      assignedDriverName: driver?.displayName,
    });
    setCaptures(finalCaptures);
    setDraft(nextDraft);
    setPhase('preview');
    setPendingText('');
    setPendingRect(null);
    setOcrNote('');
  };

  const handleSelect = (result: SelectionResult) => {
    const cleaned = applyCleaner(step.key, result.text);
    setPendingText(cleaned);
    setPendingRect(result.rect);
    setOcrNote(result.usedOcr ? 'Read via OCR (no selectable text in that area).' : '');
  };

  const confirmAndNext = () => {
    const text = pendingText.trim();

    if (isDropoffStep) {
      let next = captures;
      if (text) {
        next = withHighlight(
          { ...captures, dropoffs: [...captures.dropoffs, text] },
          'dropoff',
          `Dropoff ${captures.dropoffs.length + 1}`,
          step.color,
          pendingRect
        );
      }
      if (next.dropoffs.length === 0) return;
      setCaptures(next);
      setPendingText('');
      setPendingRect(null);
      setOcrNote('');
      setStepIndex((i) => i + 1);
      return;
    }

    if (!text) return;

    let next = captures;
    if (step.key === 'broker') next = { ...captures, broker: text };
    else if (step.key === 'loadRef') next = { ...captures, loadRef: text };
    else if (step.key === 'pickup') next = { ...captures, pickup: text };
    else if (step.key === 'payout') next = { ...captures, payout: text };

    next = withHighlight(next, step.key, step.label, step.color, pendingRect);
    setCaptures(next);
    setPendingText('');
    setPendingRect(null);
    setOcrNote('');

    if (stepIndex >= MANUAL_CAPTURE_STEPS.length - 1) {
      openPreview(next);
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const addAnotherDropoff = () => {
    const text = pendingText.trim();
    if (!text) return;
    const next = withHighlight(
      { ...captures, dropoffs: [...captures.dropoffs, text] },
      'dropoff',
      `Dropoff ${captures.dropoffs.length + 1}`,
      step.color,
      pendingRect
    );
    setCaptures(next);
    setPendingText('');
    setPendingRect(null);
    setOcrNote('');
  };

  const updateDraft = (patch: Partial<RateConDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const updateStops = (pickups: string[], dropoffsList: string[]) => {
    if (!draft) return;
    const partial: RateConStop[] = [
      ...pickups.map((address, sequence) => ({
        type: 'pickup' as const,
        address,
        sequence,
      })),
      ...dropoffsList.map((address, sequence) => ({
        type: 'dropoff' as const,
        address,
        sequence,
      })),
    ];
    updateDraft({ stops: partial, milesSource: draft.milesSource });
  };

  const recalculateMiles = async () => {
    if (!draft) return;
    setCalculatingMiles(true);
    try {
      const resolved = await resolveRateConDraftForCreate({
        ...draft,
        miles: undefined,
        milesSource: undefined,
      });
      updateDraft({
        miles: resolved.miles,
        milesSource: resolved.milesSource,
        stops: resolved.stops,
        warnings: resolved.warnings,
      });
    } catch (error) {
      updateDraft({
        warnings: [
          ...(draft.warnings || []),
          error instanceof Error ? error.message : 'Route calculation failed.',
        ],
      });
    } finally {
      setCalculatingMiles(false);
    }
  };

  const validation = draft ? validateRateConDraft(draft) : null;
  const pickupAddresses = draft ? stopAddresses(draft.stops, 'pickup') : [''];
  const dropoffAddresses = draft ? stopAddresses(draft.stops, 'dropoff') : [''];

  const canContinueCapture = isDropoffStep
    ? Boolean(pendingText.trim()) || captures.dropoffs.length > 0
    : Boolean(pendingText.trim());

  return (
    <div className="fixed inset-0 z-50 bg-surface/95 backdrop-blur-sm overflow-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 min-h-full flex flex-col">
        <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1">
              Manual select
            </p>
            <h2 className="font-[family-name:var(--font-bebas)] text-3xl tracking-wider">
              {phase === 'capture' ? 'HIGHLIGHT FIELDS' : 'PREVIEW LOAD'}
            </h2>
            <p className="text-on-surface-variant text-sm mt-1 flex items-center gap-2">
              <FileText size={14} />
              {file.name}
              {uploading && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Loader2 size={12} className="animate-spin" /> Uploading…
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-on-surface-variant hover:text-error"
            aria-label="Cancel manual import"
          >
            <X size={22} />
          </button>
        </header>

        {phase === 'capture' && (
          <>
            <nav className="flex flex-wrap gap-2 mb-5 sticky top-0 z-30 bg-surface/90 py-2 backdrop-blur">
              {MANUAL_CAPTURE_STEPS.map((s, index) => {
                const active = index === stepIndex;
                const done = stepStatus[index];
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      if (index <= stepIndex || done) setStepIndex(index);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors ${
                      active
                        ? 'border-primary bg-primary/15 text-primary'
                        : done
                          ? 'border-outline-variant text-on-surface'
                          : 'border-outline-variant/50 text-on-surface-variant'
                    }`}
                  >
                    {index + 1}. {s.label}
                    {done ? ' ✓' : ''}
                  </button>
                );
              })}
            </nav>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 flex-1">
              <PdfHighlightViewer
                file={file}
                highlights={captures.highlights}
                selectionEnabled
                activeColor={step.color}
                onSelect={handleSelect}
              />

              <aside className="border border-outline-variant bg-surface-container-low p-5 h-fit xl:sticky xl:top-16">
                <p className="text-xs uppercase tracking-wider text-primary mb-2">
                  Step {stepIndex + 1} of {MANUAL_CAPTURE_STEPS.length}
                </p>
                <h3 className="font-semibold text-lg mb-2">{step.label}</h3>
                <p className="text-on-surface-variant text-sm mb-4">{step.hint}</p>

                {isDropoffStep && captures.dropoffs.length > 0 && (
                  <ul className="mb-4 space-y-2">
                    {captures.dropoffs.map((d, i) => (
                      <li
                        key={`${d}-${i}`}
                        className="text-sm border border-outline-variant bg-surface-container px-3 py-2"
                      >
                        <span className="text-xs text-on-surface-variant uppercase tracking-wider">
                          Dropoff {i + 1}
                        </span>
                        <p className="mt-0.5">{d}</p>
                      </li>
                    ))}
                  </ul>
                )}

                <label className="block mb-3">
                  <span className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1.5">
                    Captured text
                  </span>
                  <textarea
                    value={pendingText}
                    onChange={(event) => setPendingText(event.target.value)}
                    rows={4}
                    placeholder="Draw a box on the PDF, or type here…"
                    className="w-full bg-surface-container-high border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary resize-y"
                  />
                </label>
                {ocrNote && <p className="text-xs text-on-surface-variant mb-3">{ocrNote}</p>}

                <div className="flex flex-col gap-2">
                  {isDropoffStep && (
                    <button
                      type="button"
                      disabled={!pendingText.trim()}
                      onClick={addAnotherDropoff}
                      className="flex items-center justify-center gap-2 border border-primary text-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
                    >
                      <Plus size={16} /> Add another dropoff
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canContinueCapture}
                    onClick={confirmAndNext}
                    className="flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
                  >
                    {stepIndex === MANUAL_CAPTURE_STEPS.length - 1 ? (
                      <>
                        <Check size={16} /> Continue to preview
                      </>
                    ) : isDropoffStep && !pendingText.trim() && captures.dropoffs.length > 0 ? (
                      <>
                        Done with dropoffs <ArrowRight size={16} />
                      </>
                    ) : (
                      <>
                        Confirm & next <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                  {stepIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingText('');
                        setPendingRect(null);
                        setStepIndex((i) => i - 1);
                      }}
                      className="flex items-center justify-center gap-2 text-on-surface-variant text-sm py-2"
                    >
                      <ArrowLeft size={16} /> Previous step
                    </button>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}

        {phase === 'preview' && draft && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
            <div className="border border-outline-variant bg-surface-container-low p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Field
                  label="Broker"
                  value={draft.broker || ''}
                  onChange={(broker) => updateDraft({ broker })}
                />
                <Field
                  label="Load ID / Load #"
                  value={draft.loadRef || ''}
                  onChange={(loadRef) => updateDraft({ loadRef })}
                />
                <Field
                  label="Gross / Flat rate"
                  type="number"
                  value={draft.payout?.replace(/[$,]/g, '') || ''}
                  onChange={(payout) => updateDraft({ payout })}
                />
                <Field
                  label="Miles"
                  type="number"
                  value={draft.miles || ''}
                  onChange={(miles) => updateDraft({ miles, milesSource: 'manual' })}
                />
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1.5">
                    Equipment
                  </span>
                  <select
                    value={draft.type || 'Dry Van'}
                    onChange={(event) =>
                      updateDraft({ type: event.target.value as RateConDraft['type'] })
                    }
                    className="w-full bg-surface-container-high border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option>Dry Van</option>
                    <option>Reefer</option>
                    <option>Flatbed</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-on-surface-variant mb-1.5">
                    Driver
                  </span>
                  <select
                    value={draft.assignedDriverId || ''}
                    onChange={(event) => {
                      const assignedDriverId = event.target.value;
                      updateDraft({
                        assignedDriverId: assignedDriverId || null,
                        assignedDriverName: drivers.find((d) => d.uid === assignedDriverId)
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
                <Field
                  label="Pickup date"
                  type="date"
                  value={draft.pickupDate || ''}
                  onChange={(pickupDate) => updateDraft({ pickupDate })}
                />
                <Field
                  label="Delivery date"
                  type="date"
                  value={draft.deliveryDate || ''}
                  onChange={(deliveryDate) => updateDraft({ deliveryDate })}
                />
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="text-primary" size={18} />
                  <h3 className="font-semibold">Ordered route</h3>
                </div>
                <button
                  type="button"
                  onClick={recalculateMiles}
                  disabled={calculatingMiles}
                  className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider disabled:opacity-40"
                >
                  {calculatingMiles ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Route size={15} />
                  )}
                  Preview truck miles
                </button>
              </div>
              <StopAddressTextFields
                pickups={pickupAddresses}
                dropoffs={dropoffAddresses}
                onPickupsChange={(next) => updateStops(next, dropoffAddresses)}
                onDropoffsChange={(next) => updateStops(pickupAddresses, next)}
              />

              {(draft.warnings?.length || !validation?.valid) && (
                <div className="mt-5 border-l-2 border-error pl-3 text-sm text-on-surface-variant">
                  {[...(draft.warnings || []), ...(validation?.errors || [])].map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setPhase('capture')}
                  className="border border-outline-variant px-4 py-2.5 text-sm font-bold uppercase tracking-wider"
                >
                  Back to highlights
                </button>
                <button
                  type="button"
                  disabled={!validation?.valid || uploading}
                  onClick={() => onComplete(draft, captures.highlights)}
                  className="bg-primary text-on-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider disabled:opacity-40"
                >
                  {uploading ? 'Waiting for upload…' : 'Add to import batch'}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-2">
                Source document — verify fields
              </p>
              <PdfHighlightViewer
                file={file}
                highlights={captures.highlights}
                selectionEnabled={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
