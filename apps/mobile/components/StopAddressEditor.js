import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { ChevronDown, ChevronUp, X } from 'lucide-react-native';
import {
  geocodeAddress,
  createEmptyStopDraft,
} from '@silver-crown/shared';
import { colors, typography } from '../theme';

const emptyFieldState = () => ({
  suggestions: [],
  searching: false,
  error: '',
});

function StopSection({ title, type, drafts, onChange }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [fieldStates, setFieldStates] = useState(() => drafts.map(() => emptyFieldState()));
  const debounceRef = useRef(null);
  const requestGenRef = useRef(0);

  useEffect(() => {
    setFieldStates((prev) => drafts.map((_, i) => prev[i] ?? emptyFieldState()));
  }, [drafts.length]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const patchFieldState = (index, patch) => {
    setFieldStates((prev) =>
      prev.map((state, i) => (i === index ? { ...state, ...patch } : state))
    );
  };

  const runSearch = useCallback(async (index, query) => {
    if (query.trim().length < 3) {
      patchFieldState(index, { suggestions: [], searching: false, error: '' });
      return;
    }

    const generation = ++requestGenRef.current;
    patchFieldState(index, { searching: true, error: '' });

    try {
      const results = await geocodeAddress(query);
      if (generation !== requestGenRef.current) return;
      patchFieldState(index, { suggestions: results, searching: false });
    } catch (err) {
      if (generation !== requestGenRef.current) return;
      patchFieldState(index, {
        searching: false,
        suggestions: [],
        error: err instanceof Error ? err.message : 'Address search failed',
      });
    }
  }, []);

  const updateDraft = (index, patch) => {
    const next = drafts.map((d, i) => (i === index ? { ...d, ...patch } : d));
    onChange(next);
  };

  const selectResult = (index, result) => {
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
    Keyboard.dismiss();
  };

  const move = (index, direction) => {
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

  const remove = (index) => {
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

  const labelFor = (index) => `${type === 'pickup' ? 'Pickup' : 'Drop-off'} ${index + 1}`;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={add}>
          <Text style={styles.addButton}>+ Add {type}</Text>
        </TouchableOpacity>
      </View>

      {drafts.map((draft, index) => {
        const state = fieldStates[index] ?? emptyFieldState();
        const showDropdown =
          activeIndex === index &&
          (state.searching || state.suggestions.length > 0 || state.error);

        return (
          <View key={`${type}-${index}`} style={styles.fieldCard}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldInputCol}>
                <Text style={styles.fieldLabel}>{labelFor(index)}</Text>
                <TextInput
                  style={styles.input}
                  value={draft.query}
                  onChangeText={(query) => {
                    updateDraft(index, { query, stop: null });
                    setActiveIndex(index);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => runSearch(index, query), 400);
                  }}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => {
                    setTimeout(() => {
                      if (activeIndex === index) {
                        setActiveIndex(null);
                        patchFieldState(index, { suggestions: [], error: '' });
                      }
                    }, 200);
                  }}
                  placeholder="Start typing a street address…"
                  placeholderTextColor={colors.outline}
                  autoCorrect={false}
                />
                {draft.stop ? (
                  <Text style={styles.confirmed} numberOfLines={2}>
                    ✓ {draft.stop.address}
                  </Text>
                ) : draft.query.trim().length >= 3 ? (
                  <Text style={styles.hint}>Pick a suggestion to lock in coordinates</Text>
                ) : null}
              </View>
              <View style={styles.fieldActions}>
                <TouchableOpacity onPress={() => move(index, -1)} disabled={index === 0} style={styles.iconBtn}>
                  <ChevronUp color={colors.onSurfaceVariant} size={18} opacity={index === 0 ? 0.3 : 1} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => move(index, 1)}
                  disabled={index === drafts.length - 1}
                  style={styles.iconBtn}
                >
                  <ChevronDown
                    color={colors.onSurfaceVariant}
                    size={18}
                    opacity={index === drafts.length - 1 ? 0.3 : 1}
                  />
                </TouchableOpacity>
                {drafts.length > 1 && (
                  <TouchableOpacity onPress={() => remove(index)} style={styles.iconBtn}>
                    <X color={colors.error} size={18} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {showDropdown && (
              <View style={styles.dropdown}>
                {state.searching && <Text style={styles.dropdownMeta}>Searching…</Text>}
                {state.error ? <Text style={styles.dropdownError}>{state.error}</Text> : null}
                <FlatList
                  data={state.suggestions}
                  keyExtractor={(item) => item.placeId ?? item.address}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={styles.suggestionList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => selectResult(index, item)}
                    >
                      <Text style={styles.suggestionText}>{item.address}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function StopAddressEditor({ pickups, dropoffs, onPickupsChange, onDropoffsChange }) {
  return (
    <View>
      <StopSection title="PICKUPS" type="pickup" drafts={pickups} onChange={onPickupsChange} />
      <StopSection title="DROP-OFFS" type="dropoff" drafts={dropoffs} onChange={onDropoffsChange} />
      <Text style={styles.attribution}>Address data © OpenStreetMap contributors</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  addButton: {
    color: colors.primary,
    fontFamily: typography.montserratBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldCard: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.surfaceContainerHigh,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start' },
  fieldInputCol: { flex: 1 },
  fieldLabel: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.onSurface,
    fontFamily: typography.montserrat,
    fontSize: 14,
  },
  confirmed: { color: colors.primary, fontFamily: typography.montserrat, fontSize: 12, marginTop: 6 },
  hint: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 12, marginTop: 6 },
  fieldActions: { paddingTop: 18, marginLeft: 4 },
  iconBtn: { padding: 4 },
  dropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    backgroundColor: colors.surface,
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownMeta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 12,
  },
  dropdownError: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.error,
    fontFamily: typography.montserrat,
    fontSize: 12,
  },
  suggestionList: { maxHeight: 140 },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  suggestionText: { color: colors.onSurface, fontFamily: typography.montserrat, fontSize: 14 },
  attribution: {
    color: colors.outline,
    fontFamily: typography.montserrat,
    fontSize: 10,
    marginTop: 4,
  },
});
