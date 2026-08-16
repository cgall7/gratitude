import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../constants/theme';
import { HoneycombStore } from '../services/HoneycombStore';
import { SeedsStore, SEED_CONTENT_MAX } from '../services/SeedsStore';
import { bloomDateLabel, bloomFloor, bloomHint, sealHint, validateSeedDraft, SEED_DRAFT_REASONS } from '../utils/seedDraft';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';
import { LoadState, LOAD_STATES, resolveListView } from '../components/LoadState';
import { Avatar } from '../components/Avatar';
import { ScreenHeader } from '../components/ScreenHeader';

// 8.2 Plant a seed: a gratitude note addressed to one person that stays sealed
// until a date they choose to wait for. Same chrome as ComposeNote (TO chips
// from the same hive membership, ScreenHeader, PrimaryButton) and the same
// "I am grateful for..." stem — a seed is a note that arrives late, not a
// different kind of writing. Copy is Deezine's, GRATITUDE_COPY_LIBRARY §4.
//
// No tip field: 8.3 is out of MVP1 with Strike, and a greyed "coming soon"
// control would be a promise about money movement we may not be permitted to
// make. Not built rather than built-and-disabled.
//
// ONE THING THIS SCREEN DOES DIFFERENTLY FROM ComposeNote, DELIBERATELY.
// ComposeNote loads its recipients with `.catch(err => console.warn(err))` and
// then renders "Add someone to your hive first" whenever the list is empty —
// so a failed load is indistinguishable on screen from having no friends. That
// is the same defect I shipped in SeedsStore (§22.1): an absence carries the
// union of every reason it could be absent, and the screen picked one and
// asserted it.
//
// §23.2 tier judgement, which the component can't make for me: `listConnections`
// is LOAD-BEARING here for the same reason it is on HoneycombTab — its absence
// makes this screen assert something about the user's friends. So it drives
// `unknown`, and the recipient list has four outcomes, not two.
// PLACEHOLDER COPY — @Deezine's to replace, and gathered here rather than
// scattered through the JSX so replacing it is one hunk. §23.3's draft wording
// is marked "to be replaced, not shipped", so `LoadState` deliberately ships no
// defaults; that pushes the placeholder up here where it is visible instead of
// down there where it looks decided.
//
// Written against Sage's constraint — it must not be reassuring. "We'll try
// again shortly" is a promise nothing in this code keeps, and "nothing you've
// written is affected" is a claim about data the screen never read. What the
// screen can honestly say is which thing it could not reach, and that pressing
// the button tries that thing again.
const COPY = {
  unknown: {
    title: 'Your hive didn’t load',
    body: 'We couldn’t reach it just now.',
    action: 'Try again',
  },
  stale: {
    label: 'This list may be out of date.',
    action: 'Refresh',
  },
  // §23.7 — the visible label is short because it sits under a sentence that
  // already named what failed. A screen reader user arriving at the control has
  // no such context, so the spoken label carries the object.
  retryAccessibilityLabel: 'Try loading your hive again',
};

export const PlantSeed = ({ navigation }) => {
  const [connections, setConnections] = useState([]);
  // How the last read ENDED — one of LOADING / READY / UNKNOWN. Not what the
  // section renders: `resolveListView` derives that from this plus the rows in
  // hand. Keeping the two apart is what stops the failure branch from having
  // to know what it is holding.
  const [readState, setReadState] = useState(LOAD_STATES.LOADING);
  const [recipientId, setRecipientId] = useState(null);
  const [content, setContent] = useState('');
  const [bloomAt, setBloomAt] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [planting, setPlanting] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // `useFocusEffect` re-runs this on every focus. Setting LOADING here is
      // unconditionally safe *because* it is a read outcome and not a view:
      // with rows already in hand `resolveListView` maps it to `ready`, so
      // coming back on bad wifi never blanks a list the user was picking from
      // (§23.1a).
      setReadState(LOAD_STATES.LOADING);
      HoneycombStore.listConnections()
        .then((list) => {
          if (cancelled) return;
          setConnections(list);
          setReadState(LOAD_STATES.READY);
        })
        .catch((err) => {
          if (cancelled) return;
          // Surfaced, not swallowed. Without this branch an outage reads as
          // "you have no friends," which is a different and more discouraging
          // sentence than the true one.
          //
          // It records only that the read did not return. Whether that shows
          // as `stale` or `unknown` depends on what is still on screen, which
          // is render-time knowledge — this closure would need a ref to have
          // it, and reaching for one is exactly how the earlier draft of this
          // file ended up dereferencing a ref that was never declared.
          console.warn('Failed to load connections', err);
          setReadState(LOAD_STATES.UNKNOWN);
        });
      return () => {
        cancelled = true;
      };
    }, [reloadKey])
  );

  // §23.1 as a call, not a convention. The `empty` branch below is reachable
  // only through this, and this returns `empty` only from a read that returned.
  const recipientView = resolveListView(readState, connections.length);

  const retryConnections = useCallback(() => setReloadKey((k) => k + 1), []);

  const recipientName = useMemo(
    () => connections.find((person) => person.id === recipientId)?.display_name ?? null,
    [connections, recipientId]
  );

  const dateLabel = bloomDateLabel(bloomAt);

  // Computed once per mount rather than per render: `minimumDate` and the
  // picker's fallback `value` both take it, and a fresh Date on every keystroke
  // would churn both props. It can go stale if the screen is left open for a
  // day, which is exactly why `validateSeedDraft` re-checks the date below
  // instead of trusting the picker to have constrained it.
  const earliest = useMemo(() => bloomFloor(), []);

  const draft = validateSeedDraft({ recipientId, content, bloomAt });

  // Only the two non-obvious refusals get said out loud. "Pick someone" and
  // "write something" are already legible from an empty form, and a form that
  // scolds you for not having filled it in yet is worse than a quiet one; a
  // date in the past or 500 characters exceeded is not something the screen
  // should let happen at all, so if either shows up it is a real disagreement
  // worth reading.
  const draftWarning =
    draft.reason === SEED_DRAFT_REASONS.TOO_LONG || draft.reason === SEED_DRAFT_REASONS.DATE_IN_PAST
      ? draft.message
      : null;

  const handlePlant = async () => {
    if (!draft.ok || planting) return;
    setPlanting(true);
    setError(null);
    try {
      await SeedsStore.plantSeed(recipientId, content, bloomAt);
      navigation.goBack();
    } catch (err) {
      // Deliberately a state on this screen rather than a rejection that
      // leaves a spinner behind: `seeds`/`plant_seed` 404 on the live project
      // until the migrations are applied, so this is the path a tester hits
      // today. It has to say something true and leave the typed text intact.
      console.warn('Failed to plant seed', err);
      // Authored copy, not the raw rail message — same inversion as
      // ComposeNote.js:53 (Sage, thread 14492cf2 §4).
      setError('Could not plant that seed — try again.');
    } finally {
      setPlanting(false);
    }
  };

  const onPickDate = (event, selected) => {
    // Android fires once with type 'set' or 'dismissed' and closes itself;
    // iOS keeps the spinner inline and reports every scroll.
    if (Platform.OS !== 'ios') setPickerOpen(false);
    if (event?.type === 'dismissed') return;
    if (selected) setBloomAt(selected);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="SEED"
          title="Plant a seed"
          right={
            <PressableScale onPress={() => navigation.goBack()} haptic={null} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={theme.colors.inkSoft} />
            </PressableScale>
          }
        />

        <Text style={styles.sectionLabel}>TO</Text>

        {/* §23.7 — the stale line goes BEFORE the content it is about, so a
            screen reader reaches "this list may be out of date" on the way to
            the list rather than after picking from it. */}
        {recipientView === LOAD_STATES.STALE && (
          <LoadState
            state={LOAD_STATES.STALE}
            onRetry={retryConnections}
            staleLabel={COPY.stale.label}
            staleActionLabel={COPY.stale.action}
            retryAccessibilityLabel={COPY.retryAccessibilityLabel}
            style={styles.staleRow}
          />
        )}

        {recipientView === LOAD_STATES.LOADING && (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        )}

        {recipientView === LOAD_STATES.UNKNOWN && (
          <LoadState
            state={LOAD_STATES.UNKNOWN}
            onRetry={retryConnections}
            title={COPY.unknown.title}
            body={COPY.unknown.body}
            actionLabel={COPY.unknown.action}
            retryAccessibilityLabel={COPY.retryAccessibilityLabel}
            style={styles.unknownCard}
          />
        )}

        {recipientView === LOAD_STATES.EMPTY && (
          <Text style={styles.emptyBody}>Add someone to your hive first — then you can plant them a seed.</Text>
        )}

        {(recipientView === LOAD_STATES.READY || recipientView === LOAD_STATES.STALE) && (
          <View style={styles.recipientRow}>
            {connections.map((person) => (
              <PressableScale
                key={person.id}
                onPress={() => setRecipientId(person.id)}
                style={[styles.recipientChip, recipientId === person.id && styles.recipientChipSelected]}
                accessibilityLabel={person.display_name}
                accessibilityState={{ selected: recipientId === person.id }}
              >
                <Avatar name={person.display_name} avatarUrl={person.avatar_url} size={40} />
                <Text style={styles.recipientName} numberOfLines={1}>
                  {person.display_name}
                </Text>
              </PressableScale>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>NOTE</Text>
        <TextInput
          style={styles.textInput}
          placeholder="I am grateful for..."
          placeholderTextColor={theme.colors.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={SEED_CONTENT_MAX}
          editable={!planting}
        />
        <Text style={styles.charCount}>
          {content.length}/{SEED_CONTENT_MAX}
        </Text>
        <Text style={styles.hint}>{sealHint(recipientName)}</Text>

        <Text style={styles.sectionLabel}>BLOOMS ON</Text>
        <PressableScale
          onPress={() => setPickerOpen(true)}
          style={styles.dateRow}
          disabled={planting}
          accessibilityLabel={dateLabel ? `Blooms on ${dateLabel}` : 'Choose when this blooms'}
        >
          <Ionicons name="calendar-outline" size={20} color={theme.colors.inkSoft} />
          <Text style={[styles.dateValue, !bloomAt && styles.datePlaceholder]}>{dateLabel ?? 'Choose when this blooms'}</Text>
        </PressableScale>
        {pickerOpen && (
          <DateTimePicker
            value={bloomAt ?? earliest}
            mode="date"
            minimumDate={earliest}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onPickDate}
          />
        )}
        {dateLabel && <Text style={styles.hint}>{bloomHint(recipientName, dateLabel)}</Text>}

        {draftWarning && <Text style={styles.warning}>{draftWarning}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton onPress={handlePlant} disabled={!draft.ok || planting}>
          {planting ? 'Planting…' : 'Plant this seed'}
        </PrimaryButton>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWriting,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 64,
  },
  sectionLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 12,
    marginTop: 8,
  },
  loader: {
    marginBottom: 16,
  },
  emptyBody: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  staleRow: {
    marginBottom: 12,
  },
  unknownCard: {
    marginBottom: 16,
  },
  recipientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  recipientChip: {
    alignItems: 'center',
    width: 68,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  recipientChipSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.washYellow,
  },
  recipientName: {
    ...theme.type.bodySm,
    color: theme.colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
  textInput: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 6,
  },
  hint: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    marginTop: 8,
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dateValue: {
    ...theme.type.body,
    color: theme.colors.textPrimary,
  },
  datePlaceholder: {
    color: theme.colors.textSecondary,
  },
  // A live validation disagreement is not an action failure. Pixel's register
  // argument for `danger` — "destructive intent and *action* failure, attached
  // to a control you just pressed" — excludes this: nothing was pressed, the
  // form is disagreeing with what is typed. So it stays in the reading register,
  // where `inkSoft` on the cream ground is 6.08:1.
  warning: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginBottom: 16,
  },
  // This one IS an action failure — the button was pressed and the send did not
  // happen — so it takes `danger`, the app's answer for that register.
  //
  // KNOWN FAILING, and deliberately not fixed here. `danger` #E5484D on this
  // screen's `backgroundWriting` ground is 3.774:1 at bodySm (14px = 10.5pt, so
  // the 3:1 large-text path is not available) — a seventh site of the six Pixel
  // enumerated in the §23 thread. I am not inventing a local colour to dodge it:
  // a bespoke hex here is exactly the invented-number failure mode R61 warns
  // about, and it would have to be un-invented when the token retune lands.
  // This site inherits that open item rather than starting a new class.
  error: {
    ...theme.type.bodySm,
    color: theme.colors.danger,
    marginBottom: 16,
  },
});
