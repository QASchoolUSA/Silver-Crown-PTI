import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  geocodeAddress,
  createEmptyStopDraft,
  type GeocodeResult,
  type StopDraft,
  type StopType,
} from '@silver-crown/shared';

interface FieldSearchState {
  suggestions: GeocodeResult[];
  searching: boolean;
  error: string;
  highlightIndex: number;
}

const emptyFieldState = (): FieldSearchState => ({
  suggestions: [],
  searching: false,
  error: '',
  highlightIndex: -1,
});

interface StopSectionProps {
  title: string;
  type: StopType;
  drafts: StopDraft[];
  onChange: (drafts: StopDraft[]) => void;
}

function StopSection({ title, type, drafts, onChange }: StopSectionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [fieldStates, setFieldStates] = useState<FieldSearchState[]>(() =>
    drafts.map(() => emptyFieldState())
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestGenRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFieldStates((prev) =>
      drafts.map((_, i) => prev[i] ?? emptyFieldState())
    );
  }, [drafts.length]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setActiveIndex(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const patchFieldState = (index: number, patch: Partial<FieldSearchState>) => {
    setFieldStates((prev) =>
      prev.map((state, i) => (i === index ? { ...state, ...patch } : state))
    );
  };

  const runSearch = useCallback(async (index: number, query: string) => {
    if (query.trim().length < 3) {
      patchFieldState(index, { suggestions: [], searching: false, error: '', highlightIndex: -1 });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = ++requestGenRef.current;

    patchFieldState(index, { searching: true, error: '', highlightIndex: -1 });

    try {
      const results = await geocodeAddress(query);
      if (controller.signal.aborted || generation !== requestGenRef.current) return;
      patchFieldState(index, { suggestions: results, searching: false, highlightIndex: results.length ? 0 : -1 });
    } catch (err) {
      if (controller.signal.aborted || generation !== requestGenRef.current) return;
      patchFieldState(index, {
        searching: false,
        suggestions: [],
        error: err instanceof Error ? err.message : 'Address search failed',
        highlightIndex: -1,
      });
    }
  }, []);

  const updateDraft = (index: number, patch: Partial<StopDraft>) => {
    const next = drafts.map((d, i) => (i === index ? { ...d, ...patch } : d));
    onChange(next);
  };

  const selectResult = (index: number, result: GeocodeResult) => {
    updateDraft(index, {
      query: result.address,
      stop: {
        type,
        address: result.address,
        coords: result.coords,
        sequence: index,
      },
    });
    setActiveIndex(null);
    patchFieldState(index, emptyFieldState());
  };

  const dismissField = (index: number) => {
    if (activeIndex === index) setActiveIndex(null);
    patchFieldState(index, { suggestions: [], highlightIndex: -1, error: '' });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= drafts.length) return;
    const next = [...drafts];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(
      next.map((d, i) =>
        d.stop ? { ...d, stop: { ...d.stop, type, sequence: i } } : d
      )
    );
    setFieldStates((prev) => {
      const nextStates = [...prev];
      [nextStates[index], nextStates[target]] = [nextStates[target], nextStates[index]];
      return nextStates;
    });
  };

  const remove = (index: number) => {
    if (drafts.length <= 1) return;
    const next = drafts.filter((_, i) => i !== index);
    onChange(
      next.map((d, i) =>
        d.stop ? { ...d, stop: { ...d.stop, type, sequence: i } } : d
      )
    );
    setFieldStates((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex(null);
  };

  const add = () => {
    onChange([...drafts, createEmptyStopDraft(type, drafts.length)]);
    setFieldStates((prev) => [...prev, emptyFieldState()]);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    const state = fieldStates[index] ?? emptyFieldState();
    const { suggestions, highlightIndex } = state;

    if (event.key === 'Escape') {
      event.preventDefault();
      dismissField(index);
      return;
    }

    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      patchFieldState(index, {
        highlightIndex: Math.min(highlightIndex + 1, suggestions.length - 1),
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      patchFieldState(index, {
        highlightIndex: Math.max(highlightIndex - 1, 0),
      });
    } else if (event.key === 'Enter' && highlightIndex >= 0) {
      event.preventDefault();
      selectResult(index, suggestions[highlightIndex]);
    }
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{title}</h2>
        <button
          type="button"
          onClick={add}
          className="text-xs text-primary font-bold uppercase tracking-wider hover:underline"
        >
          + Add {type}
        </button>
      </div>

      {drafts.map((draft, index) => {
        const state = fieldStates[index] ?? emptyFieldState();
        const showDropdown =
          activeIndex === index &&
          (state.searching || state.suggestions.length > 0 || state.error);

        return (
          <div
            key={`${type}-${index}`}
            className="relative border border-outline-variant rounded-lg p-3 bg-surface-container-high"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                  {type === 'pickup' ? 'Pickup' : 'Drop-off'} {index + 1}
                </label>
                <input
                  type="text"
                  value={draft.query}
                  onChange={(e) => {
                    const query = e.target.value;
                    updateDraft(index, { query, stop: null });
                    setActiveIndex(index);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => runSearch(index, query), 400);
                  }}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (activeIndex === index) dismissField(index);
                    }, 150);
                  }}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  placeholder="Start typing a street address…"
                  className="w-full mt-1 bg-surface border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-primary"
                  required
                  autoComplete="off"
                />
                {draft.stop ? (
                  <p className="text-xs text-primary mt-1 truncate" title={draft.stop.address}>
                    ✓ {draft.stop.address}
                  </p>
                ) : draft.query.trim().length >= 3 ? (
                  <p className="text-xs text-on-surface-variant mt-1">
                    Pick a suggestion to lock in coordinates
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1 pt-5">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="p-1 text-on-surface-variant disabled:opacity-30">
                  <ChevronUp size={16} />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === drafts.length - 1} className="p-1 text-on-surface-variant disabled:opacity-30">
                  <ChevronDown size={16} />
                </button>
                {drafts.length > 1 && (
                  <button type="button" onClick={() => remove(index)} className="p-1 text-error">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {showDropdown && (
              <div className="absolute left-3 right-3 top-full z-20 mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg overflow-hidden">
                {state.searching && <p className="px-3 py-2 text-xs text-on-surface-variant">Searching…</p>}
                {state.error && <p className="px-3 py-2 text-xs text-error">{state.error}</p>}
                {state.suggestions.map((result, suggestionIndex) => (
                  <button
                    key={result.placeId ?? result.address}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectResult(index, result)}
                    className={`block w-full text-left px-3 py-2 text-sm text-on-surface border-t border-outline-variant first:border-t-0 ${
                      suggestionIndex === state.highlightIndex
                        ? 'bg-surface-container-high'
                        : 'hover:bg-surface-container-high'
                    }`}
                  >
                    {result.address}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function StopAddressEditor({
  pickups,
  dropoffs,
  onPickupsChange,
  onDropoffsChange,
}: {
  pickups: StopDraft[];
  dropoffs: StopDraft[];
  onPickupsChange: (drafts: StopDraft[]) => void;
  onDropoffsChange: (drafts: StopDraft[]) => void;
}) {
  return (
    <div className="space-y-6">
      <StopSection title="Pickups" type="pickup" drafts={pickups} onChange={onPickupsChange} />
      <StopSection title="Drop-offs" type="dropoff" drafts={dropoffs} onChange={onDropoffsChange} />
    </div>
  );
}
