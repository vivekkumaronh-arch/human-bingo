import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { ChallengeCard } from './components/ChallengeCard';
import { CollageScreen } from './components/CollageScreen';
import { EventCreatedScreen } from './components/EventCreatedScreen';
import { JoinEventScreen } from './components/JoinEventScreen';
import { LeaderboardView } from './components/LeaderboardView';
import { ManageCodeScreen } from './components/ManageCodeScreen';
import { OrganiserView } from './components/OrganiserView';
import { PhotoPreviewModal } from './components/PhotoPreviewModal';
import { RegistrationScreen } from './components/RegistrationScreen';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { SupabaseSetupNotice } from './components/SupabaseSetupNotice';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CHALLENGES, type ChallengePhotoMap } from './data/challenges';
import { isSupabaseConfigured } from './lib/supabase';
import {
  closeManagedEvent,
  createPublicEvent,
  fetchEventConfig,
  fetchManagedEventsHistory,
  fetchParticipants,
  normalizeManagementCode,
  openEventManagement,
  rankCompletedParticipants,
  registerParticipant,
  resetManagedEventLeaderboard,
  resumeParticipant,
  setChallengeStatus,
  subscribeToEventUpdates,
  updateManagedEvent,
  validateJoiningCode,
} from './services/bingoApi';
import type {
  CreatedEventResult,
  EventConfig,
  ManagedEventSummary,
  ParticipantRecord,
  StoredParticipantSession,
} from './types/multiplayer';
import { processImageLocally } from './utils/imageProcessor';

const SESSION_STORAGE_KEY = 'human-bingo-active-session-v1';
const MANAGED_CODES_STORAGE_KEY = 'human-bingo-managed-codes-v1';

function photoStorageKey(participantId: string): string {
  return `human-bingo-photos-${participantId}`;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function loadSavedSession(): StoredParticipantSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredParticipantSession>;
    if (
      parsed &&
      typeof parsed.participantId === 'string' &&
      typeof parsed.sessionToken === 'string' &&
      typeof parsed.eventId === 'string' &&
      typeof parsed.fullName === 'string'
    ) {
      return parsed as StoredParticipantSession;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredParticipantSession | null): void {
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage errors
  }
}

function loadSavedManagementCodes(): string[] {
  try {
    const raw = window.localStorage.getItem(MANAGED_CODES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .filter((item): item is string => typeof item === 'string')
          .map(normalizeManagementCode)
          .filter((code) => code.length >= 8),
      ),
    );
  } catch {
    return [];
  }
}

function rememberManagementCode(code: string): string[] {
  const normalized = normalizeManagementCode(code);
  const existing = loadSavedManagementCodes().filter((c) => c !== normalized);
  const updated = [normalized, ...existing].slice(0, 50);
  try {
    window.localStorage.setItem(MANAGED_CODES_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return updated;
}

function loadPhotosForParticipant(participantId: string): ChallengePhotoMap {
  try {
    const raw = window.localStorage.getItem(photoStorageKey(participantId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const validMap: ChallengePhotoMap = {};
    for (const challenge of CHALLENGES) {
      const entry = (parsed as Record<string, unknown>)[String(challenge.id)];
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { dataUrl?: unknown }).dataUrl === 'string' &&
        (entry as { dataUrl: string }).dataUrl.startsWith('data:image/')
      ) {
        validMap[challenge.id] = {
          dataUrl: (entry as { dataUrl: string }).dataUrl,
          fileName:
            typeof (entry as { fileName?: unknown }).fileName === 'string'
              ? (entry as { fileName: string }).fileName
              : `challenge-${challenge.id}.jpg`,
          updatedAt:
            typeof (entry as { updatedAt?: unknown }).updatedAt === 'number'
              ? (entry as { updatedAt: number }).updatedAt
              : Date.now(),
        };
      }
    }
    return validMap;
  } catch {
    return {};
  }
}

function savePhotosForParticipant(
  participantId: string,
  photos: ChallengePhotoMap,
): void {
  try {
    window.localStorage.setItem(photoStorageKey(participantId), JSON.stringify(photos));
  } catch {
    // Ignore quota errors
  }
}

type ActiveView =
  | 'welcome'
  | 'event-created'
  | 'join'
  | 'manage-code'
  | 'manage'
  | 'register'
  | 'play'
  | 'collage'
  | 'leaderboard';

export default function App() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  return <MultiplayerHumanBingo />;
}

function MultiplayerHumanBingo() {
  const [view, setView] = useState<ActiveView>('welcome');
  const [previousView, setPreviousView] = useState<ActiveView>('welcome');
  const [isInitializing, setIsInitializing] = useState(true);

  // Active participant / event-scoped state
  const [activeEvent, setActiveEvent] = useState<EventConfig | null>(null);
  const [session, setSession] = useState<StoredParticipantSession | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<ParticipantRecord | null>(
    null,
  );
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [photos, setPhotos] = useState<ChallengePhotoMap>({});

  // Welcome, creation & joining states
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [createdEventResult, setCreatedEventResult] =
    useState<CreatedEventResult | null>(null);
  const [isValidatingJoinCode, setIsValidatingJoinCode] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Play UI states
  const [previewChallengeId, setPreviewChallengeId] = useState<number | null>(null);
  const [isResetPhotosModalOpen, setIsResetPhotosModalOpen] = useState(false);
  const [isResettingPhotos, setIsResettingPhotos] = useState(false);

  // Code-based event management state (completely separate from participant play state)
  const [managedCodes, setManagedCodes] = useState<string[]>(() =>
    loadSavedManagementCodes(),
  );
  const [managedEvents, setManagedEvents] = useState<ManagedEventSummary[]>([]);
  const [activeManagementCode, setActiveManagementCode] = useState<string | null>(null);
  const [managedParticipants, setManagedParticipants] = useState<ParticipantRecord[]>([]);
  const [isValidatingManageCode, setIsValidatingManageCode] = useState(false);
  const [manageCodeError, setManageCodeError] = useState<string | null>(null);
  const [isLoadingManagedEvents, setIsLoadingManagedEvents] = useState(false);
  const [closingEventId, setClosingEventId] = useState<string | null>(null);
  const [manageActionError, setManageActionError] = useState<string | null>(null);
  const [isEventResetModalOpen, setIsEventResetModalOpen] = useState(false);
  const [isResettingEvent, setIsResettingEvent] = useState(false);

  // Deduplicates rapid taps on START CHALLENGE via server-side idempotency key
  const pendingRegistrationKeyRef = useRef<string | null>(null);

  const refreshActiveParticipants = useCallback(async (eventId: string) => {
    try {
      const list = await fetchParticipants(eventId);
      setParticipants(list);
      setSession((activeSession) => {
        if (!activeSession || activeSession.eventId !== eventId) return activeSession;
        const match = list.find((p) => p.id === activeSession.participantId);
        if (match) {
          setCurrentParticipant(match);
        }
        return activeSession;
      });
    } catch {
      // Transient fetch failures should not crash the UI
    }
  }, []);

  const refreshActiveEventConfig = useCallback(async (eventId: string) => {
    try {
      const cfg = await fetchEventConfig(eventId);
      if (cfg) {
        setActiveEvent(cfg);
      }
    } catch {
      // Ignore transient errors
    }
  }, []);

  const refreshManagedEventsData = useCallback(
    async (codesOverride?: string[], preferredCode?: string | null) => {
      const codesToLoad = codesOverride ?? managedCodes;
      if (codesToLoad.length === 0) {
        setManagedEvents([]);
        setManagedParticipants([]);
        return;
      }

      setIsLoadingManagedEvents(true);
      try {
        const summaries = await fetchManagedEventsHistory(codesToLoad);
        setManagedEvents(summaries);

        const targetCode =
          preferredCode &&
          summaries.some(
            (e) =>
              normalizeManagementCode(e.management_code) ===
              normalizeManagementCode(preferredCode),
          )
            ? normalizeManagementCode(preferredCode)
            : activeManagementCode &&
                summaries.some(
                  (e) =>
                    normalizeManagementCode(e.management_code) ===
                    normalizeManagementCode(activeManagementCode),
                )
              ? normalizeManagementCode(activeManagementCode)
              : summaries[0]?.management_code ?? null;

        setActiveManagementCode(targetCode);

        const targetEvent = summaries.find(
          (e) =>
            normalizeManagementCode(e.management_code) ===
            normalizeManagementCode(targetCode ?? ''),
        );
        if (targetEvent) {
          const list = await fetchParticipants(targetEvent.id);
          setManagedParticipants(list);
        } else {
          setManagedParticipants([]);
        }
      } catch (err) {
        setManageActionError(
          err instanceof Error ? err.message : 'Could not load event management data.',
        );
      } finally {
        setIsLoadingManagedEvents(false);
      }
    },
    [activeManagementCode, managedCodes],
  );

  // Bootstrap saved participant session on load
  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const saved = loadSavedSession();
        if (saved) {
          const [resumed, cfg] = await Promise.all([
            resumeParticipant(saved.participantId, saved.sessionToken),
            fetchEventConfig(saved.eventId),
          ]);
          if (!isMounted) return;

          if (resumed.found && resumed.participant && cfg) {
            const list = await fetchParticipants(cfg.id);
            if (!isMounted) return;

            const restoredPhotos = loadPhotosForParticipant(saved.participantId);
            setActiveEvent(cfg);
            setParticipants(list);
            setSession(saved);
            setCurrentParticipant(resumed.participant);
            setPhotos(restoredPhotos);

            const allPhotosPresent =
              CHALLENGES.filter((c) => Boolean(restoredPhotos[c.id])).length ===
              CHALLENGES.length;
            setView(
              resumed.participant.is_completed && allPhotosPresent ? 'collage' : 'play',
            );
            return;
          }

          // Stale session cleanup
          saveSession(null);
          try {
            window.localStorage.removeItem(photoStorageKey(saved.participantId));
          } catch {
            // Ignore
          }
        }
        setView('welcome');
      } catch (err) {
        if (isMounted) {
          setWelcomeError(
            err instanceof Error
              ? err.message
              : 'Could not connect to Supabase. Please verify your configuration.',
          );
          setView('welcome');
        }
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  // Scoped Realtime subscription strictly for the participant's active event_id
  useEffect(() => {
    if (!activeEvent?.id) return;

    const eventId = activeEvent.id;
    void refreshActiveParticipants(eventId);

    const unsubscribe = subscribeToEventUpdates(
      eventId,
      () => {
        void refreshActiveParticipants(eventId);
      },
      () => {
        void refreshActiveEventConfig(eventId);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [activeEvent?.id, refreshActiveEventConfig, refreshActiveParticipants]);

  const selectedManagedEvent = useMemo(() => {
    if (!activeManagementCode) return managedEvents[0] ?? null;
    return (
      managedEvents.find(
        (e) =>
          normalizeManagementCode(e.management_code) ===
          normalizeManagementCode(activeManagementCode),
      ) ??
      managedEvents[0] ??
      null
    );
  }, [activeManagementCode, managedEvents]);

  // Scoped Realtime subscription strictly for the managed event in Event Management
  useEffect(() => {
    if (view !== 'manage' || !selectedManagedEvent?.id) return;

    const eventId = selectedManagedEvent.id;
    void refreshManagedEventsData();

    const unsubscribe = subscribeToEventUpdates(
      eventId,
      () => {
        void refreshManagedEventsData();
      },
      () => {
        void refreshManagedEventsData();
      },
    );

    return () => {
      unsubscribe();
    };
  }, [refreshManagedEventsData, selectedManagedEvent?.id, view]);

  // Load managed history when opening the Manage Code screen
  useEffect(() => {
    if (view === 'manage-code' && managedCodes.length > 0) {
      void refreshManagedEventsData();
    }
  }, [managedCodes.length, refreshManagedEventsData, view]);

  // Persist local browser photos per participant ID
  useEffect(() => {
    if (!session) return;
    savePhotosForParticipant(session.participantId, photos);
  }, [photos, session]);

  const handleCreateNewEventFromWelcome = useCallback(async () => {
    if (isCreatingEvent) return;
    setWelcomeError(null);
    setIsCreatingEvent(true);

    try {
      const created = await createPublicEvent();
      const updatedCodes = rememberManagementCode(created.management_code);
      setManagedCodes(updatedCodes);
      setActiveManagementCode(created.management_code);
      setCreatedEventResult(created);
      setView('event-created');
    } catch (err) {
      setWelcomeError(
        err instanceof Error
          ? err.message
          : 'Could not create event. Please verify your database connection.',
      );
    } finally {
      setIsCreatingEvent(false);
    }
  }, [isCreatingEvent]);

  const handleCreateNewEventFromDashboard = useCallback(
    async (title?: string) => {
      if (isCreatingEvent) return;
      setManageActionError(null);
      setIsCreatingEvent(true);

      try {
        const created = await createPublicEvent(title);
        const updatedCodes = rememberManagementCode(created.management_code);
        setManagedCodes(updatedCodes);
        setActiveManagementCode(created.management_code);
        setManagedParticipants([]);
        await refreshManagedEventsData(updatedCodes, created.management_code);
      } catch (err) {
        setManageActionError(
          err instanceof Error ? err.message : 'Could not create new event.',
        );
      } finally {
        setIsCreatingEvent(false);
      }
    },
    [isCreatingEvent, refreshManagedEventsData],
  );

  const handleUpdateCreatedEventName = useCallback(
    async (title: string) => {
      if (!createdEventResult) return;
      const updated = await updateManagedEvent(createdEventResult.management_code, {
        title,
      });
      setCreatedEventResult({
        ...createdEventResult,
        event: updated,
      });
    },
    [createdEventResult],
  );

  const handleValidateManagementCode = useCallback(
    async (code: string) => {
      if (isValidatingManageCode) return;
      setManageCodeError(null);
      setIsValidatingManageCode(true);

      try {
        const result = await openEventManagement(code);
        if (!result.valid) {
          setManageCodeError(result.message);
          return;
        }

        const updatedCodes = rememberManagementCode(result.management_code);
        setManagedCodes(updatedCodes);
        setActiveManagementCode(result.management_code);
        setManageActionError(null);
        await refreshManagedEventsData(updatedCodes, result.management_code);
        setView('manage');
      } catch (err) {
        setManageCodeError(
          err instanceof Error ? err.message : 'Unable to verify management code.',
        );
      } finally {
        setIsValidatingManageCode(false);
      }
    },
    [isValidatingManageCode, refreshManagedEventsData],
  );

  const handleJoinEvent = useCallback(
    async (joiningCode: string) => {
      if (isValidatingJoinCode) return;
      setJoinError(null);
      setIsValidatingJoinCode(true);

      try {
        const result = await validateJoiningCode(joiningCode);
        if (!result.valid) {
          setJoinError(result.message);
          return;
        }

        pendingRegistrationKeyRef.current = null;
        setActiveEvent(result.event);
        setParticipants([]);
        setRegisterError(null);
        setErrorMessage(null);
        setView('register');
        void refreshActiveParticipants(result.event.id);
      } catch (err) {
        setJoinError(
          err instanceof Error
            ? err.message
            : 'Unable to validate joining code right now. Please try again.',
        );
      } finally {
        setIsValidatingJoinCode(false);
      }
    },
    [isValidatingJoinCode, refreshActiveParticipants],
  );

  const handleExitParticipantFlow = useCallback(() => {
    saveSession(null);
    pendingRegistrationKeyRef.current = null;
    setSession(null);
    setCurrentParticipant(null);
    setPhotos({});
    setPreviewChallengeId(null);
    setActiveEvent(null);
    setParticipants([]);
    setRegisterError(null);
    setErrorMessage(null);
    setJoinError(null);
    setView('welcome');
  }, []);

  const handleRegister = useCallback(
    async (fullName: string) => {
      if (isRegistering || !activeEvent) return;
      setRegisterError(null);
      setIsRegistering(true);

      if (!pendingRegistrationKeyRef.current) {
        pendingRegistrationKeyRef.current = generateUuid();
      }

      try {
        const result = await registerParticipant(
          fullName,
          pendingRegistrationKeyRef.current,
          activeEvent,
        );
        pendingRegistrationKeyRef.current = null;

        saveSession(result.session);
        setSession(result.session);
        setCurrentParticipant(result.participant);
        setPhotos({});
        setErrorMessage(null);
        setView('play');
        void refreshActiveParticipants(activeEvent.id);
      } catch (err) {
        setRegisterError(
          err instanceof Error
            ? err.message
            : 'Could not register participant. Please try again.',
        );
      } finally {
        setIsRegistering(false);
      }
    },
    [activeEvent, isRegistering, refreshActiveParticipants],
  );

  const uploadedCount = useMemo(
    () => CHALLENGES.filter((c) => Boolean(photos[c.id])).length,
    [photos],
  );

  const isAllUploaded = uploadedCount === CHALLENGES.length;
  const progressRatio = uploadedCount / CHALLENGES.length;
  const progressPercent = Math.round(progressRatio * 100);

  const rankedFinishers = useMemo(
    () => rankCompletedParticipants(participants),
    [participants],
  );

  const currentRank = useMemo(() => {
    if (!session) return null;
    const found = rankedFinishers.find((p) => p.id === session.participantId);
    return found ? found.rank : null;
  }, [rankedFinishers, session]);

  const handleSelectFile = useCallback(
    async (challengeId: number, file: File) => {
      if (!session) return;
      if (activeEvent && activeEvent.status !== 'active') {
        setErrorMessage(
          'This event has been closed and no longer accepts new progress.',
        );
        return;
      }
      setErrorMessage(null);
      const previousPhoto = photos[challengeId];

      try {
        const processedPhoto = await processImageLocally(file);
        setPhotos((prev) => ({
          ...prev,
          [challengeId]: processedPhoto,
        }));

        const updated = await setChallengeStatus(
          session.participantId,
          session.sessionToken,
          challengeId,
          true,
        );
        setCurrentParticipant(updated.participant);
        void refreshActiveParticipants(session.eventId);
      } catch (err) {
        setPhotos((prev) => {
          const next = { ...prev };
          if (previousPhoto) {
            next[challengeId] = previousPhoto;
          } else {
            delete next[challengeId];
          }
          return next;
        });
        const message =
          err instanceof Error
            ? err.message
            : 'Could not load that image. Please use a JPG, JPEG, or PNG file.';
        setErrorMessage(message);
      }
    },
    [activeEvent, photos, refreshActiveParticipants, session],
  );

  const handleRemovePhoto = useCallback(
    async (challengeId: number) => {
      if (!session) return;
      if (activeEvent && activeEvent.status !== 'active') {
        setErrorMessage(
          'This event has been closed and no longer accepts new progress.',
        );
        return;
      }
      setErrorMessage(null);

      const previousPhoto = photos[challengeId];
      setPhotos((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });

      if (view === 'collage') {
        setView('play');
      }

      try {
        const updated = await setChallengeStatus(
          session.participantId,
          session.sessionToken,
          challengeId,
          false,
        );
        setCurrentParticipant(updated.participant);
        void refreshActiveParticipants(session.eventId);
      } catch (err) {
        if (previousPhoto) {
          setPhotos((prev) => ({
            ...prev,
            [challengeId]: previousPhoto,
          }));
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Could not update challenge status on the server.',
        );
      }
    },
    [activeEvent, photos, refreshActiveParticipants, session, view],
  );

  const handleConfirmResetPhotos = useCallback(async () => {
    if (!session || isResettingPhotos) return;
    setIsResettingPhotos(true);
    setErrorMessage(null);

    try {
      for (const challenge of CHALLENGES) {
        if (photos[challenge.id]) {
          const updated = await setChallengeStatus(
            session.participantId,
            session.sessionToken,
            challenge.id,
            false,
          );
          setCurrentParticipant(updated.participant);
        }
      }
      setPhotos({});
      savePhotosForParticipant(session.participantId, {});
      setPreviewChallengeId(null);
      setIsResetPhotosModalOpen(false);
      void refreshActiveParticipants(session.eventId);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not reset progress. Please try again.',
      );
    } finally {
      setIsResettingPhotos(false);
    }
  }, [isResettingPhotos, photos, refreshActiveParticipants, session]);

  const handleCreateCollage = useCallback(() => {
    if (!isAllUploaded || !activeEvent) return;
    setPreviewChallengeId(null);
    setView('collage');
    void refreshActiveParticipants(activeEvent.id);
  }, [activeEvent, isAllUploaded, refreshActiveParticipants]);

  // Starts a new participant session under the active event if open, otherwise asks for joining code
  const handleStartNewChallenge = useCallback(() => {
    saveSession(null);
    pendingRegistrationKeyRef.current = null;
    setSession(null);
    setCurrentParticipant(null);
    setPhotos({});
    setPreviewChallengeId(null);
    setErrorMessage(null);
    setRegisterError(null);
    setView(activeEvent && activeEvent.status === 'active' ? 'register' : 'join');
  }, [activeEvent]);

  const handleUpdateManagedTitle = useCallback(
    async (managementCode: string, title: string) => {
      setManageActionError(null);
      try {
        const updated = await updateManagedEvent(managementCode, { title });
        if (activeEvent?.id === updated.id) {
          setActiveEvent(updated);
        }
        await refreshManagedEventsData(managedCodes, managementCode);
      } catch (err) {
        setManageActionError(
          err instanceof Error ? err.message : 'Could not update event name.',
        );
      }
    },
    [activeEvent?.id, managedCodes, refreshManagedEventsData],
  );

  const handleToggleManagedReplay = useCallback(
    async (managementCode: string, allowReplay: boolean) => {
      setManageActionError(null);
      try {
        const updated = await updateManagedEvent(managementCode, {
          allow_replay: allowReplay,
        });
        if (activeEvent?.id === updated.id) {
          setActiveEvent(updated);
        }
        await refreshManagedEventsData(managedCodes, managementCode);
      } catch (err) {
        setManageActionError(
          err instanceof Error ? err.message : 'Could not update event settings.',
        );
      }
    },
    [activeEvent?.id, managedCodes, refreshManagedEventsData],
  );

  const handleCloseManagedEvent = useCallback(
    async (managementCode: string, eventId: string) => {
      if (closingEventId) return;
      setManageActionError(null);
      setClosingEventId(eventId);
      try {
        const updated = await closeManagedEvent(managementCode);
        if (activeEvent?.id === eventId) {
          setActiveEvent(updated);
        }
        await refreshManagedEventsData(managedCodes, managementCode);
      } catch (err) {
        setManageActionError(
          err instanceof Error ? err.message : 'Could not close event.',
        );
      } finally {
        setClosingEventId(null);
      }
    },
    [activeEvent?.id, closingEventId, managedCodes, refreshManagedEventsData],
  );

  const handleConfirmManagedEventReset = useCallback(async () => {
    if (isResettingEvent || !selectedManagedEvent) return;
    setIsResettingEvent(true);
    setManageActionError(null);
    const targetEventId = selectedManagedEvent.id;

    try {
      await resetManagedEventLeaderboard(selectedManagedEvent.management_code);
      if (session && session.eventId === targetEventId) {
        try {
          window.localStorage.removeItem(photoStorageKey(session.participantId));
        } catch {
          // Ignore
        }
        saveSession(null);
        setSession(null);
        setCurrentParticipant(null);
        setPhotos({});
      }
      if (activeEvent?.id === targetEventId) {
        setParticipants([]);
      }
      setIsEventResetModalOpen(false);
      await refreshManagedEventsData(managedCodes, selectedManagedEvent.management_code);
    } catch (err) {
      setManageActionError(
        err instanceof Error ? err.message : 'Could not reset event leaderboard.',
      );
      setIsEventResetModalOpen(false);
    } finally {
      setIsResettingEvent(false);
    }
  }, [
    activeEvent?.id,
    isResettingEvent,
    managedCodes,
    refreshManagedEventsData,
    selectedManagedEvent,
    session,
  ]);

  const openLeaderboard = useCallback(
    (from: ActiveView) => {
      if (!activeEvent) return;
      setPreviousView(from);
      setView('leaderboard');
      void refreshActiveParticipants(activeEvent.id);
    },
    [activeEvent, refreshActiveParticipants],
  );

  const previewChallenge = useMemo(
    () => CHALLENGES.find((c) => c.id === previewChallengeId) ?? null,
    [previewChallengeId],
  );

  if (isInitializing) {
    return (
      <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center gap-2.5 p-6">
        <Loader2 className="w-6 h-6 animate-spin text-[#258A83]" aria-hidden="true" />
        <p className="text-xs sm:text-sm font-semibold text-[#4F627A]">
          Loading Human Bingo…
        </p>
      </div>
    );
  }

  if (view === 'event-created' && createdEventResult) {
    return (
      <EventCreatedScreen
        event={createdEventResult.event}
        managementCode={createdEventResult.management_code}
        onUpdateEventName={handleUpdateCreatedEventName}
        onOpenManagement={() => {
          void refreshManagedEventsData(managedCodes, createdEventResult.management_code);
          setView('manage');
        }}
        onBackToWelcome={() => setView('welcome')}
      />
    );
  }

  if (view === 'manage-code') {
    return (
      <ManageCodeScreen
        isValidating={isValidatingManageCode}
        errorMessage={manageCodeError}
        recentEvents={managedEvents}
        onValidateManagementCode={handleValidateManagementCode}
        onOpenRecentEvent={(evt) => {
          setActiveManagementCode(evt.management_code);
          void refreshManagedEventsData(managedCodes, evt.management_code);
          setView('manage');
        }}
        onClearError={() => setManageCodeError(null)}
        onBack={() => setView('welcome')}
      />
    );
  }

  if (view === 'manage' && (selectedManagedEvent || activeManagementCode)) {
    return (
      <>
        <OrganiserView
          events={managedEvents}
          selectedEvent={selectedManagedEvent}
          participants={managedParticipants}
          isLoadingEvents={isLoadingManagedEvents}
          isCreatingEvent={isCreatingEvent}
          closingEventId={closingEventId}
          actionError={manageActionError}
          onCreateNewEvent={handleCreateNewEventFromDashboard}
          onUpdateEventTitle={handleUpdateManagedTitle}
          onCloseEvent={handleCloseManagedEvent}
          onSelectEvent={(managementCode) => {
            setActiveManagementCode(managementCode);
            void refreshManagedEventsData(managedCodes, managementCode);
          }}
          onSwitchManagementCode={() => {
            setManageCodeError(null);
            setView('manage-code');
          }}
          onToggleAllowReplay={handleToggleManagedReplay}
          onRequestResetEvent={() => setIsEventResetModalOpen(true)}
          onClearError={() => setManageActionError(null)}
          onBackHome={() => setView('welcome')}
        />
        <ResetConfirmModal
          isOpen={isEventResetModalOpen}
          completedCount={managedParticipants.length}
          title={
            selectedManagedEvent
              ? `Reset leaderboard for ${selectedManagedEvent.joining_code}?`
              : 'Reset entire event leaderboard?'
          }
          description={`This will permanently remove all ${managedParticipants.length} registered participants from this event and clear its leaderboard. Other events will not be affected.`}
          confirmLabel="Reset Leaderboard"
          isBusy={isResettingEvent}
          onCancel={() => setIsEventResetModalOpen(false)}
          onConfirm={handleConfirmManagedEventReset}
        />
      </>
    );
  }

  if (view === 'leaderboard' && activeEvent) {
    const backTarget: ActiveView =
      previousView === 'collage' && session && isAllUploaded
        ? 'collage'
        : session
          ? 'play'
          : 'register';
    const backLabel =
      backTarget === 'collage'
        ? 'Back to Collage'
        : backTarget === 'play'
          ? 'Back to Grid'
          : 'Back to Registration';

    return (
      <LeaderboardView
        participants={participants}
        currentParticipantId={session?.participantId ?? null}
        eventTitle={activeEvent.title}
        joiningCode={activeEvent.joining_code}
        onBack={() => setView(backTarget)}
        backLabel={backLabel}
      />
    );
  }

  if (view === 'join') {
    return (
      <JoinEventScreen
        isValidating={isValidatingJoinCode}
        errorMessage={joinError}
        onJoinEvent={handleJoinEvent}
        onBack={() => setView('welcome')}
        onClearError={() => setJoinError(null)}
      />
    );
  }

  if (view === 'welcome' || !activeEvent) {
    return (
      <WelcomeScreen
        isCreatingEvent={isCreatingEvent}
        errorMessage={welcomeError}
        onCreateNewEvent={handleCreateNewEventFromWelcome}
        onJoinExistingEvent={() => {
          setJoinError(null);
          setView('join');
        }}
        onOpenManageWithCode={() => {
          setManageCodeError(null);
          setView('manage-code');
        }}
      />
    );
  }

  if (view === 'register' || !session) {
    return (
      <RegistrationScreen
        activeEvent={activeEvent}
        participantCount={participants.length}
        maxParticipants={activeEvent.max_participants}
        isSubmitting={isRegistering}
        errorMessage={registerError || errorMessage}
        onRegister={handleRegister}
        onChangeJoiningCode={() => {
          setActiveEvent(null);
          setParticipants([]);
          setRegisterError(null);
          setJoinError(null);
          setView('join');
        }}
        onOpenLeaderboard={() => openLeaderboard('register')}
      />
    );
  }

  if (view === 'collage' && isAllUploaded) {
    return (
      <CollageScreen
        participantName={session.fullName}
        challenges={CHALLENGES}
        photos={photos}
        rank={currentRank}
        durationSeconds={currentParticipant?.duration_seconds ?? null}
        allowReplay={activeEvent.allow_replay && activeEvent.status === 'active'}
        onBackToEdit={() => setView('play')}
        onViewLeaderboard={() => openLeaderboard('collage')}
        onStartNewChallenge={handleStartNewChallenge}
      />
    );
  }

  const displayCount = uploadedCount;
  const isEventClosed = activeEvent.status !== 'active';
  const statusLabel =
    isAllUploaded && currentParticipant?.is_completed ? 'Completed' : 'In Progress';

  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-3 py-2 sm:px-6 sm:py-5">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-2xl flex flex-col">
        {/* Compact Corporate Networking Header */}
        <header className="text-center mb-2 sm:mb-3.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] sm:text-xs font-semibold text-[#4F627A] truncate">
                Player: <strong className="text-[#142B49]">{session.fullName}</strong>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-[#DCE3EC] bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#258A83] shrink-0">
                <KeyRound className="w-2.5 h-2.5" aria-hidden="true" />
                {activeEvent.joining_code}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleExitParticipantFlow}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] px-2 py-1 text-[10px] sm:text-xs font-semibold text-[#4F627A] hover:text-[#142B49] whitespace-nowrap transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                <span>Switch Event</span>
              </button>

              <button
                type="button"
                onClick={() => openLeaderboard('play')}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] px-2 py-1 text-[10px] sm:text-xs font-semibold text-[#142B49] whitespace-nowrap transition-colors cursor-pointer"
              >
                <Trophy className="w-3 h-3 text-[#258A83]" aria-hidden="true" />
                <span>Leaderboard</span>
                <span className="text-[#4F627A] tabular-nums">({participants.length})</span>
              </button>
            </div>
          </div>

          <p className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#258A83]">
            NETWORKING ACTIVITY · {activeEvent.joining_code}
          </p>
          <h1 className="font-display text-lg sm:text-3xl font-extrabold tracking-tight text-[#142B49] leading-tight">
            HUMAN BINGO
          </h1>
          <p className="text-[11px] sm:text-sm font-semibold text-[#142B49]/85">
            Meet people. Find connections.
          </p>
        </header>

        {/* Closed Event Notice */}
        {isEventClosed && (
          <div
            role="status"
            className="mb-2 rounded-xl border border-[#DCE3EC] bg-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[#4F627A]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-[#E25546] shrink-0" aria-hidden="true" />
              <p className="text-xs font-medium">
                This event has been closed. New photo submissions are disabled.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExitParticipantFlow}
              className="px-2.5 py-1 rounded-lg border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-[11px] font-bold text-[#142B49] whitespace-nowrap cursor-pointer"
            >
              Join Another Event
            </button>
          </div>
        )}

        {/* Inline Validation Error */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-2 rounded-xl border border-[#F08B76]/50 bg-[#FDF5F3] px-3 py-1.5 flex items-center justify-between gap-2 text-[#A63A24]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-[#D96D57] shrink-0" aria-hidden="true" />
              <p className="text-xs font-medium truncate">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label="Dismiss error"
              className="p-1 rounded-lg hover:bg-[#F08B76]/15 text-[#A63A24] shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Warm Cream / Ivory 3x3 Human Bingo Board */}
        <main className="rounded-2xl sm:rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-2 sm:p-3.5 shadow-[0_10px_30px_rgba(20,43,73,0.07)]">
          <div className="flex items-center justify-between gap-2 px-0.5 mb-1.5 sm:mb-2.5">
            <span className="text-[9.5px] sm:text-[11px] font-bold tracking-[0.16em] text-[#7D6E5D]">
              BINGO BOARD
            </span>
            <span
              className="inline-flex items-center rounded-full bg-[#E25546] px-2 py-0.5 text-[9.5px] sm:text-[11px] font-bold tracking-wider text-white tabular-nums shadow-[0_1px_4px_rgba(226,85,70,0.3)]"
              aria-live="polite"
            >
              {displayCount}/{CHALLENGES.length} FILLED
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {CHALLENGES.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                photo={photos[challenge.id]}
                onSelectFile={handleSelectFile}
                onRemovePhoto={handleRemovePhoto}
                onPreviewPhoto={(id) => setPreviewChallengeId(id)}
              />
            ))}
          </div>
        </main>

        {/* Live Participant Progress & Submit Section */}
        <footer className="mt-2 sm:mt-3.5 flex flex-col gap-2">
          <div className="rounded-xl sm:rounded-2xl bg-white border border-[#DCE3EC] px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_2px_8px_rgba(20,43,73,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 text-[11px] sm:text-xs">
                <span className="font-bold text-[#142B49] truncate">
                  {session.fullName}
                </span>
                <span className="text-[#DCE3EC]" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`font-bold tabular-nums whitespace-nowrap ${
                    isAllUploaded ? 'text-[#258A83]' : 'text-[#142B49]'
                  }`}
                >
                  {displayCount}/{CHALLENGES.length} ({progressPercent}%)
                </span>
                <span className="text-[#DCE3EC] hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline font-medium text-[#4F627A]">
                  {statusLabel}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openLeaderboard('play')}
                  className="px-2 py-1 rounded-lg border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[10.5px] sm:text-xs font-semibold text-[#258A83] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Live Progress</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsResetPhotosModalOpen(true)}
                  disabled={displayCount === 0 || isEventClosed}
                  className="px-2 py-1 rounded-lg border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-[10.5px] sm:text-xs font-semibold text-[#142B49]/80 hover:text-[#142B49] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div
              className="mt-1.5 w-full h-1.5 rounded-full bg-[#E6ECF3] overflow-hidden"
              role="progressbar"
              aria-valuenow={displayCount}
              aria-valuemin={0}
              aria-valuemax={CHALLENGES.length}
              aria-label={`${displayCount} of ${CHALLENGES.length} photos uploaded`}
            >
              <div
                className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#258A83] to-[#142B49] transition-transform duration-200"
                style={{ transform: `scaleX(${progressRatio})` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateCollage}
            disabled={!isAllUploaded}
            className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] focus-visible:ring-offset-2 ${
              isAllUploaded
                ? 'bg-[#258A83] hover:bg-[#1E726C] text-white shadow-[0_4px_14px_rgba(37,138,131,0.28)] cursor-pointer active:scale-[0.99]'
                : 'bg-[#E2E8F0] text-[#7A8BA0] cursor-not-allowed'
            }`}
          >
            <span>Submit &amp; Create Collage</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </footer>
      </div>

      <PhotoPreviewModal
        challenge={previewChallenge}
        photo={previewChallenge ? photos[previewChallenge.id] : undefined}
        onClose={() => setPreviewChallengeId(null)}
        onSelectFile={handleSelectFile}
        onRemovePhoto={handleRemovePhoto}
      />

      <ResetConfirmModal
        isOpen={isResetPhotosModalOpen}
        completedCount={displayCount}
        isBusy={isResettingPhotos}
        onCancel={() => setIsResetPhotosModalOpen(false)}
        onConfirm={handleConfirmResetPhotos}
      />
    </div>
  );
}
