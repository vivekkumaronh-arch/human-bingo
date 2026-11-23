import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  KeyRound,
  Loader2,
  Lock,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { ChallengeCard } from './components/ChallengeCard';
import { ChallengePhotoModal } from './components/ChallengePhotoModal';
import { CollageScreen } from './components/CollageScreen';
import { EventPhotoWall } from './components/EventPhotoWall';
import { GameBottomNav, type GameNavTab } from './components/GameBottomNav';
import { GameCreatedScreen } from './components/GameCreatedScreen';
import { JoinGameScreen } from './components/JoinGameScreen';
import { LeaderboardView } from './components/LeaderboardView';
import { PlayersView } from './components/PlayersView';
import { SupabaseSetupNotice } from './components/SupabaseSetupNotice';
import { WelcomeScreen } from './components/WelcomeScreen';
import {
  CHALLENGES,
  type ChallengePhotoMap,
  type UploadedPhoto,
} from './data/challenges';
import { isSupabaseConfigured } from './lib/supabase';
import {
  buildEventInvitationText,
  createGame,
  endGame,
  fetchEventConfig,
  fetchParticipantEventWall,
  fetchParticipants,
  getEffectiveEventStatus,
  joinGame,
  rankCompletedParticipants,
  removeChallengePhoto,
  resumeParticipant,
  submissionsToPhotoMap,
  submitChallengePhoto,
  subscribeToEventUpdates,
  updateGameTitle,
  uploadChallengePhotoToStorage,
} from './services/bingoApi';
import type {
  CreatedGameResult,
  EventConfig,
  EventPhotoWallSubmission,
  ParticipantRecord,
  StoredParticipantSession,
} from './types/multiplayer';
import { dataUrlToUploadPayload, processImageLocally } from './utils/imageProcessor';

const SESSION_STORAGE_KEY = 'human-bingo-active-session-v1';
const LEGACY_MANAGED_CODES_STORAGE_KEY = 'human-bingo-managed-codes-v1';

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
        ((entry as { dataUrl: string }).dataUrl.startsWith('data:image/') ||
          (entry as { dataUrl: string }).dataUrl.startsWith('https://') ||
          (entry as { dataUrl: string }).dataUrl.startsWith('http://'))
      ) {
        const typedEntry = entry as {
          dataUrl: string;
          storagePath?: unknown;
          fileName?: unknown;
          updatedAt?: unknown;
          submittedAt?: unknown;
        };
        validMap[challenge.id] = {
          dataUrl: typedEntry.dataUrl,
          storagePath:
            typeof typedEntry.storagePath === 'string' ? typedEntry.storagePath : undefined,
          fileName:
            typeof typedEntry.fileName === 'string'
              ? typedEntry.fileName
              : `challenge-${challenge.id}.jpg`,
          updatedAt:
            typeof typedEntry.updatedAt === 'number'
              ? typedEntry.updatedAt
              : Date.now(),
          verificationStatus: 'approved',
          submittedAt:
            typeof typedEntry.submittedAt === 'string' ? typedEntry.submittedAt : undefined,
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
  | 'game-created'
  | 'join'
  | 'play'
  | 'photo-wall'
  | 'leaderboard'
  | 'players'
  | 'collage';

export default function App() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }

  return <MultiplayerHumanBingo />;
}

function MultiplayerHumanBingo() {
  const [view, setView] = useState<ActiveView>('welcome');
  const [isInitializing, setIsInitializing] = useState(true);

  // Active game & participant state
  const [activeEvent, setActiveEvent] = useState<EventConfig | null>(null);
  const [session, setSession] = useState<StoredParticipantSession | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<ParticipantRecord | null>(
    null,
  );
  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [photos, setPhotos] = useState<ChallengePhotoMap>({});
  const [eventWallPhotos, setEventWallPhotos] = useState<EventPhotoWallSubmission[]>([]);
  const [isLoadingEventWall, setIsLoadingEventWall] = useState(false);
  const [eventWallError, setEventWallError] = useState<string | null>(null);

  // Creator session tokens kept strictly in memory (never localStorage or URLs)
  const [creatorTokensByGameId, setCreatorTokensByGameId] = useState<
    Record<string, string>
  >({});

  // Create & join states
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [createdGameResult, setCreatedGameResult] =
    useState<CreatedGameResult | null>(null);
  const [isUpdatingGameTitle, setIsUpdatingGameTitle] = useState(false);
  const [prefillJoinCode, setPrefillJoinCode] = useState<string>('');
  const [isJoiningGame, setIsJoiningGame] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Play & modal states
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
  const [cameraChallengeId, setCameraChallengeId] = useState<number | null>(null);
  const [uploadingChallengeIds, setUploadingChallengeIds] = useState<
    Record<number, boolean>
  >({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [headerShareCopied, setHeaderShareCopied] = useState(false);

  // Creator End Game control state
  const [isEndingGame, setIsEndingGame] = useState(false);
  const [endGameError, setEndGameError] = useState<string | null>(null);

  // Deduplicates rapid taps on JOIN GAME via idempotency key
  const pendingJoinKeyRef = useRef<string | null>(null);
  const uploadingSetRef = useRef<Set<number>>(new Set());
  const sessionRef = useRef<StoredParticipantSession | null>(null);
  const lastSyncedUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const syncParticipantSubmissions = useCallback(
    async (participantId: string, sessionToken: string) => {
      try {
        const resumed = await resumeParticipant(participantId, sessionToken);
        if (resumed.found && resumed.participant) {
          lastSyncedUpdatedAtRef.current = resumed.participant.updated_at;
          setCurrentParticipant(resumed.participant);
          setPhotos((prev) => submissionsToPhotoMap(resumed.submissions, prev));
        }
      } catch {
        // Ignore transient sync errors
      }
    },
    [],
  );

  const refreshEventWall = useCallback(
    async (participantId: string, sessionToken: string, showSpinner = false) => {
      if (showSpinner) {
        setIsLoadingEventWall(true);
      }
      setEventWallError(null);
      try {
        const wall = await fetchParticipantEventWall(participantId, sessionToken);
        setEventWallPhotos(wall);
      } catch (err) {
        if (showSpinner) {
          setEventWallError(
            err instanceof Error
              ? err.message
              : 'Could not load shared photos right now.',
          );
        }
      } finally {
        if (showSpinner) {
          setIsLoadingEventWall(false);
        }
      }
    },
    [],
  );

  const refreshActiveParticipants = useCallback(
    async (eventId: string) => {
      try {
        const list = await fetchParticipants(eventId);
        setParticipants(list);
        const activeSession = sessionRef.current;
        if (activeSession && activeSession.eventId === eventId) {
          const match = list.find((p) => p.id === activeSession.participantId);
          if (match) {
            setCurrentParticipant(match);
            if (match.updated_at !== lastSyncedUpdatedAtRef.current) {
              void syncParticipantSubmissions(
                activeSession.participantId,
                activeSession.sessionToken,
              );
            }
          }
          void refreshEventWall(activeSession.participantId, activeSession.sessionToken);
        }
      } catch {
        // Transient fetch failures should not interrupt gameplay
      }
    },
    [refreshEventWall, syncParticipantSubmissions],
  );

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

  // Reconnect saved participant session on page load / refresh
  useEffect(() => {
    let isMounted = true;

    try {
      window.localStorage.removeItem(LEGACY_MANAGED_CODES_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup
    }

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

            const cachedPhotos = loadPhotosForParticipant(saved.participantId);
            const hydratedPhotos = submissionsToPhotoMap(
              resumed.submissions,
              cachedPhotos,
            );
            lastSyncedUpdatedAtRef.current = resumed.participant.updated_at;
            setActiveEvent(cfg);
            setParticipants(list);
            setSession(saved);
            setCurrentParticipant(resumed.participant);
            setPhotos(hydratedPhotos);
            void refreshEventWall(saved.participantId, saved.sessionToken);
            setView('play');
            return;
          }

          // Clear stale session if participant or game no longer exists
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
              : 'Could not connect to the game server. Please verify your configuration.',
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
  }, [refreshEventWall]);

  // Scoped Realtime subscription for active game
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

  // Periodic background refresh for Photo Wall, Leaderboard & Players views + tab refocus
  useEffect(() => {
    if (!activeEvent?.id || !session) return;

    const refreshAll = () => {
      void refreshActiveParticipants(activeEvent.id);
      void refreshActiveEventConfig(activeEvent.id);
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshAll();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const shouldPoll =
      view === 'photo-wall' || view === 'leaderboard' || view === 'players';
    const intervalId = shouldPoll ? window.setInterval(refreshAll, 15_000) : null;

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [
    activeEvent?.id,
    refreshActiveEventConfig,
    refreshActiveParticipants,
    session,
    view,
  ]);

  // Watch 48-hour expiry for the open active game
  useEffect(() => {
    if (!activeEvent || activeEvent.status !== 'active' || !activeEvent.expires_at) {
      return;
    }

    const expiresMs = new Date(activeEvent.expires_at).getTime();
    if (!Number.isFinite(expiresMs)) return;

    const markExpiredIfDue = () => {
      if (Date.now() >= expiresMs) {
        setActiveEvent((prev) =>
          prev && prev.id === activeEvent.id && prev.status === 'active'
            ? { ...prev, status: 'expired' }
            : prev,
        );
      }
    };

    markExpiredIfDue();
    const delayMs = Math.max(0, expiresMs - Date.now());
    const timeoutId = window.setTimeout(
      markExpiredIfDue,
      Math.min(delayMs, 2_147_483_647),
    );
    const intervalId = window.setInterval(markExpiredIfDue, 30_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [activeEvent?.expires_at, activeEvent?.id, activeEvent?.status]);

  // Cache participant photos locally for fast board hydration
  useEffect(() => {
    if (!session) return;
    savePhotosForParticipant(session.participantId, photos);
  }, [photos, session]);

  // 1. CREATE GAME (one click, generates unique 4-digit joining code + 48h expiry)
  const handleCreateGame = useCallback(async () => {
    if (isCreatingGame) return;
    setWelcomeError(null);
    setIsCreatingGame(true);

    try {
      const created = await createGame();
      setCreatorTokensByGameId((prev) => ({
        ...prev,
        [created.event.id]: created.creator_token,
      }));
      setCreatedGameResult(created);
      setView('game-created');
    } catch (err) {
      setWelcomeError(
        err instanceof Error
          ? err.message
          : 'Could not create game right now. Please try again.',
      );
    } finally {
      setIsCreatingGame(false);
    }
  }, [isCreatingGame]);

  const handleUpdateCreatedTitle = useCallback(
    async (title: string) => {
      if (!createdGameResult || isUpdatingGameTitle) return;
      setIsUpdatingGameTitle(true);
      try {
        const updatedEvent = await updateGameTitle(
          createdGameResult.event.id,
          createdGameResult.creator_token,
          title,
        );
        setCreatedGameResult((prev) =>
          prev ? { ...prev, event: updatedEvent } : null,
        );
        if (activeEvent?.id === updatedEvent.id) {
          setActiveEvent(updatedEvent);
        }
      } finally {
        setIsUpdatingGameTitle(false);
      }
    },
    [activeEvent?.id, createdGameResult, isUpdatingGameTitle],
  );

  // 2. JOIN GAME (single-step 4-digit code + Your Name)
  const handleJoinGameSubmit = useCallback(
    async (joiningCode: string, fullName: string) => {
      if (isJoiningGame) return;
      setJoinError(null);
      setIsJoiningGame(true);

      if (!pendingJoinKeyRef.current) {
        pendingJoinKeyRef.current = generateUuid();
      }

      try {
        const result = await joinGame(
          joiningCode,
          fullName,
          pendingJoinKeyRef.current,
        );

        if (!result.valid) {
          if (result.reason !== 'rate_limited') {
            pendingJoinKeyRef.current = null;
          }
          setJoinError(result.message);
          return;
        }

        pendingJoinKeyRef.current = null;
        lastSyncedUpdatedAtRef.current = result.participant.updated_at;

        saveSession(result.session);
        setSession(result.session);
        setActiveEvent(result.event);
        setCurrentParticipant(result.participant);
        setPhotos({});
        setEventWallPhotos([]);
        setParticipants([result.participant]);
        setSelectedChallengeId(null);
        setCameraChallengeId(null);
        setErrorMessage(null);
        setEndGameError(null);
        setCreatedGameResult(null);
        setPrefillJoinCode('');
        setView('play');

        void refreshActiveParticipants(result.event.id);
        void refreshEventWall(result.session.participantId, result.session.sessionToken);
      } catch (err) {
        setJoinError(
          err instanceof Error
            ? err.message
            : 'Unable to join game right now. Please try again.',
        );
      } finally {
        setIsJoiningGame(false);
      }
    },
    [isJoiningGame, refreshActiveParticipants, refreshEventWall],
  );

  const handleLeaveGame = useCallback(() => {
    saveSession(null);
    pendingJoinKeyRef.current = null;
    lastSyncedUpdatedAtRef.current = null;
    setSession(null);
    setCurrentParticipant(null);
    setPhotos({});
    setEventWallPhotos([]);
    setEventWallError(null);
    setSelectedChallengeId(null);
    setCameraChallengeId(null);
    setActiveEvent(null);
    setParticipants([]);
    setErrorMessage(null);
    setEndGameError(null);
    setJoinError(null);
    setPrefillJoinCode('');
    setView('welcome');
  }, []);

  // Completed challenge counts (photo submitted = completed immediately)
  const completedCount = useMemo(
    () => CHALLENGES.filter((c) => Boolean(photos[c.id])).length,
    [photos],
  );
  const isAllCompleted = completedCount === CHALLENGES.length;
  const progressPercent = Math.round((completedCount / CHALLENGES.length) * 100);

  const rankedFinishers = useMemo(
    () => rankCompletedParticipants(participants),
    [participants],
  );

  const currentRank = useMemo(() => {
    if (!session) return null;
    const found = rankedFinishers.find((p) => p.id === session.participantId);
    return found ? found.rank : null;
  }, [rankedFinishers, session]);

  const activeCreatorToken = activeEvent
    ? creatorTokensByGameId[activeEvent.id] ?? null
    : null;
  const isCreator = Boolean(activeCreatorToken);

  const handleEndGame = useCallback(async () => {
    if (!activeEvent || !activeCreatorToken || isEndingGame) return;
    setEndGameError(null);
    setIsEndingGame(true);

    try {
      const updatedEvent = await endGame(activeEvent.id, activeCreatorToken);
      setActiveEvent(updatedEvent);
    } catch (err) {
      setEndGameError(
        err instanceof Error ? err.message : 'Could not end this game right now.',
      );
    } finally {
      setIsEndingGame(false);
    }
  }, [activeCreatorToken, activeEvent, isEndingGame]);

  const ensureActiveGameForUpload = useCallback(() => {
    if (!activeEvent) return;
    const status = getEffectiveEventStatus(activeEvent);
    if (status === 'expired') {
      throw new Error('This game has expired after 48 hours.');
    }
    if (status !== 'active') {
      throw new Error('This game has ended and no longer accepts new photos.');
    }
  }, [activeEvent]);

  // Core backend upload & submission handler (marks complete ONLY after backend succeeds)
  const handleSubmitProcessedPhoto = useCallback(
    async (challengeId: number, processedPhoto: UploadedPhoto) => {
      if (!session) return;
      if (uploadingSetRef.current.has(challengeId)) return;

      ensureActiveGameForUpload();

      uploadingSetRef.current.add(challengeId);
      setUploadingChallengeIds((prev) => ({ ...prev, [challengeId]: true }));
      setErrorMessage(null);

      try {
        const { blob, contentType, extension } = dataUrlToUploadPayload(
          processedPhoto.dataUrl,
        );

        const uploadedStorage = await uploadChallengePhotoToStorage(
          session.eventId,
          session.participantId,
          challengeId,
          blob,
          contentType,
          extension,
        );

        const updated = await submitChallengePhoto(
          session.participantId,
          session.sessionToken,
          challengeId,
          uploadedStorage.path,
          uploadedStorage.publicUrl,
        );

        lastSyncedUpdatedAtRef.current = updated.participant.updated_at;
        setCurrentParticipant(updated.participant);
        setPhotos((prev) =>
          submissionsToPhotoMap(updated.submissions, {
            ...prev,
            [challengeId]: processedPhoto,
          }),
        );
        void refreshActiveParticipants(session.eventId);
        void refreshEventWall(session.participantId, session.sessionToken);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not upload that photograph. Please try again.';
        setErrorMessage(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        uploadingSetRef.current.delete(challengeId);
        setUploadingChallengeIds((prev) => {
          const next = { ...prev };
          delete next[challengeId];
          return next;
        });
      }
    },
    [
      ensureActiveGameForUpload,
      refreshActiveParticipants,
      refreshEventWall,
      session,
    ],
  );

  // Camera capture or desktop drag/drop File -> process locally -> upload -> mark complete
  const handleSubmitRawFile = useCallback(
    async (challengeId: number, file: File) => {
      ensureActiveGameForUpload();
      const processedPhoto = await processImageLocally(file);
      await handleSubmitProcessedPhoto(challengeId, processedPhoto);
    },
    [ensureActiveGameForUpload, handleSubmitProcessedPhoto],
  );

  const handleOpenCamera = useCallback(
    (challengeId: number) => {
      if (!session || uploadingSetRef.current.has(challengeId)) return;
      try {
        ensureActiveGameForUpload();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Game is closed.');
        return;
      }
      setErrorMessage(null);
      setCameraChallengeId(challengeId);
    },
    [ensureActiveGameForUpload, session],
  );

  const handleRemovePhoto = useCallback(
    async (challengeId: number) => {
      if (!session || uploadingSetRef.current.has(challengeId)) return;
      ensureActiveGameForUpload();
      setErrorMessage(null);

      const previousPhoto = photos[challengeId];
      setPhotos((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });

      try {
        const updated = await removeChallengePhoto(
          session.participantId,
          session.sessionToken,
          challengeId,
        );
        lastSyncedUpdatedAtRef.current = updated.participant.updated_at;
        setCurrentParticipant(updated.participant);
        setPhotos((prev) => submissionsToPhotoMap(updated.submissions, prev));
        void refreshActiveParticipants(session.eventId);
        void refreshEventWall(session.participantId, session.sessionToken);
      } catch (err) {
        if (previousPhoto) {
          setPhotos((prev) => ({
            ...prev,
            [challengeId]: previousPhoto,
          }));
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Could not remove that photo right now.';
        setErrorMessage(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [
      ensureActiveGameForUpload,
      photos,
      refreshActiveParticipants,
      refreshEventWall,
      session,
    ],
  );

  const handleShareCodeFromHeader = async () => {
    if (!activeEvent) return;
    const appUrl =
      typeof window !== 'undefined' ? window.location.origin : undefined;
    const text = buildEventInvitationText({
      eventTitle: activeEvent.title,
      joiningCode: activeEvent.joining_code,
      appUrl,
    });

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: activeEvent.title || 'Human Bingo',
          text,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setHeaderShareCopied(true);
      window.setTimeout(() => setHeaderShareCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSelectNavTab = (tab: GameNavTab) => {
    setView(tab);
    if (!activeEvent || !session) return;
    if (tab === 'photo-wall') {
      void refreshEventWall(
        session.participantId,
        session.sessionToken,
        eventWallPhotos.length === 0,
      );
      void refreshActiveParticipants(activeEvent.id);
    } else if (tab === 'leaderboard' || tab === 'players') {
      void refreshActiveParticipants(activeEvent.id);
    }
  };

  const selectedChallenge = useMemo(
    () => CHALLENGES.find((c) => c.id === selectedChallengeId) ?? null,
    [selectedChallengeId],
  );

  const cameraChallenge = useMemo(
    () => CHALLENGES.find((c) => c.id === cameraChallengeId) ?? null,
    [cameraChallengeId],
  );

  if (isInitializing) {
    return (
      <div className="min-h-dvh w-full bg-[#F4F6F8] text-[#172E4D] flex flex-col items-center justify-center gap-2.5 p-6">
        <Loader2 className="w-6 h-6 animate-spin text-[#218F87]" aria-hidden="true" />
        <p className="text-xs sm:text-sm font-semibold text-[#4F6075]">
          Loading Human Bingo…
        </p>
      </div>
    );
  }

  if (view === 'game-created' && createdGameResult) {
    return (
      <GameCreatedScreen
        event={createdGameResult.event}
        isUpdatingTitle={isUpdatingGameTitle}
        onUpdateTitle={handleUpdateCreatedTitle}
        onStartPlaying={(code) => {
          setPrefillJoinCode(code);
          setJoinError(null);
          pendingJoinKeyRef.current = null;
          setView('join');
        }}
        onBackToHome={() => {
          setCreatedGameResult(null);
          setView('welcome');
        }}
      />
    );
  }

  if (view === 'join') {
    return (
      <JoinGameScreen
        initialCode={prefillJoinCode}
        isJoining={isJoiningGame}
        errorMessage={joinError}
        onJoinGame={handleJoinGameSubmit}
        onClearError={() => setJoinError(null)}
        onBack={() => {
          setJoinError(null);
          setView(createdGameResult ? 'game-created' : 'welcome');
        }}
      />
    );
  }

  if (view === 'welcome' || !activeEvent || !session) {
    return (
      <WelcomeScreen
        isCreatingGame={isCreatingGame}
        errorMessage={welcomeError}
        onCreateGame={handleCreateGame}
        onJoinGame={() => {
          setPrefillJoinCode('');
          setJoinError(null);
          pendingJoinKeyRef.current = null;
          setView('join');
        }}
      />
    );
  }

  if (view === 'collage' && isAllCompleted) {
    return (
      <CollageScreen
        participantName={session.fullName}
        challenges={CHALLENGES}
        photos={photos}
        rank={currentRank}
        durationSeconds={currentParticipant?.duration_seconds ?? null}
        completedCount={completedCount}
        onBackToBoard={() => setView('play')}
        onViewLeaderboard={() => handleSelectNavTab('leaderboard')}
        onViewPhotoWall={() => handleSelectNavTab('photo-wall')}
      />
    );
  }

  const effectiveEventStatus = getEffectiveEventStatus(activeEvent);
  const isEventExpired = effectiveEventStatus === 'expired';
  const isEventClosed = effectiveEventStatus !== 'active';
  const activeNavTab: GameNavTab =
    view === 'photo-wall' || view === 'leaderboard' || view === 'players'
      ? view
      : 'play';

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-[#F4F6F8] text-[#172E4D] flex flex-col">
      {/* Compact Sticky Top Bar */}
      <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-[#E2E8F0]">
        <div className="w-full max-w-3xl mx-auto px-3.5 sm:px-6 h-13 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-sm sm:text-base font-extrabold tracking-tight text-[#172E4D] truncate">
              HUMAN BINGO
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#DCE3EC] bg-[#FBF6EE] px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-[#218F87] shrink-0">
              <KeyRound className="w-2.5 h-2.5" aria-hidden="true" />
              {activeEvent.joining_code}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="max-w-[110px] min-[390px]:max-w-[150px] truncate text-xs font-bold text-[#4F6075]">
              {session.fullName}
            </span>
            <button
              type="button"
              onClick={handleShareCodeFromHeader}
              aria-label="Share game code"
              className="min-w-[36px] min-h-[36px] px-2.5 rounded-xl border border-[#DCE3EC] bg-[#F4F6F8] hover:bg-[#EAEFF6] text-[#172E4D] text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              {headerShareCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#218F87]" aria-hidden="true" />
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#218F87]" aria-hidden="true" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Active Tab Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-3 py-3 sm:px-6 sm:py-5 pb-24">
        {isEventClosed && (
          <div
            role="status"
            className="mb-3 rounded-xl border border-[#DCE3EC] bg-white px-3.5 py-2.5 flex items-center justify-between gap-2 text-[#4F6075]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-[#E25546] shrink-0" aria-hidden="true" />
              <p className="text-xs font-medium">
                {isEventExpired
                  ? 'This game expired after 48 hours. New photo uploads are closed.'
                  : 'This game has ended. New photo uploads are closed.'}
              </p>
            </div>
          </div>
        )}

        {activeNavTab === 'play' && (
          <div className="w-full max-w-xl mx-auto flex flex-col gap-3">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-[#F08B76]/55 bg-[#FDF5F3] px-3 py-2 flex items-center justify-between gap-2 text-[#A63A24]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle
                    className="w-4 h-4 text-[#D96D57] shrink-0"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium">{errorMessage}</p>
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

            {/* 3x3 Pastel Human Bingo Board */}
            <section className="rounded-2xl sm:rounded-3xl bg-[#FBF6EE] border border-[#EAE0CF] p-2.5 sm:p-4 shadow-[0_10px_30px_rgba(23,46,77,0.07)]">
              <div className="flex items-center justify-between gap-2 px-0.5 mb-2 sm:mb-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.16em] text-[#7D6E5D] uppercase truncate">
                    {activeEvent.title}
                  </p>
                  <p className="text-xs font-semibold text-[#172E4D]">
                    Tap any square to snap or upload a photo
                  </p>
                </div>
                <span
                  aria-live="polite"
                  className="inline-flex items-center rounded-full bg-[#218F87] px-2.5 py-0.5 text-[10.5px] sm:text-xs font-bold tracking-wide text-white tabular-nums shrink-0"
                >
                  {completedCount}/{CHALLENGES.length} DONE
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 min-[375px]:gap-2 sm:gap-3">
                {CHALLENGES.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    photo={photos[challenge.id]}
                    isUploading={Boolean(uploadingChallengeIds[challenge.id])}
                    isEventClosed={isEventClosed}
                    onSelectCard={(id) => setSelectedChallengeId(id)}
                    onDropFile={(id, file) => {
                      void handleSubmitRawFile(id, file).catch(() => {
                        // Error surfaced in inline alert banner
                      });
                    }}
                  />
                ))}
              </div>
            </section>

            {/* Compact Progress Card + Collage CTA when 9/9 completed */}
            <section className="rounded-2xl bg-white border border-[#DCE3EC] px-3.5 py-3 shadow-[0_2px_8px_rgba(23,46,77,0.04)] flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="font-bold text-[#172E4D]">Your Progress</span>
                <span className="font-extrabold text-[#218F87]">
                  {completedCount}/{CHALLENGES.length} ({progressPercent}%)
                </span>
              </div>

              <div
                className="w-full h-2 rounded-full bg-[#E6ECF3] overflow-hidden"
                role="progressbar"
                aria-valuenow={completedCount}
                aria-valuemin={0}
                aria-valuemax={CHALLENGES.length}
                aria-label={`Completed ${completedCount} of ${CHALLENGES.length} challenges`}
              >
                <div
                  className="h-full rounded-full bg-[#218F87] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {isAllCompleted && (
                <button
                  type="button"
                  onClick={() => setView('collage')}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#218F87] hover:bg-[#19756E] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-[0_4px_12px_rgba(33,143,135,0.24)] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>View Your 9/9 Bingo Collage</span>
                </button>
              )}
            </section>
          </div>
        )}

        {activeNavTab === 'photo-wall' && (
          <EventPhotoWall
            eventTitle={activeEvent.title}
            joiningCode={activeEvent.joining_code}
            currentParticipantId={session.participantId}
            participants={participants}
            photos={eventWallPhotos}
            isLoading={isLoadingEventWall}
            errorMessage={eventWallError}
            onRefresh={() =>
              void refreshEventWall(session.participantId, session.sessionToken, true)
            }
            onBackToPlay={() => handleSelectNavTab('play')}
          />
        )}

        {activeNavTab === 'leaderboard' && (
          <LeaderboardView
            participants={participants}
            totalSubmittedPhotos={eventWallPhotos.length}
            currentParticipantId={session.participantId}
          />
        )}

        {activeNavTab === 'players' && (
          <PlayersView
            event={activeEvent}
            participants={participants}
            currentParticipantId={session.participantId}
            isCreator={isCreator}
            isEndingGame={isEndingGame}
            endGameError={endGameError}
            onEndGame={handleEndGame}
            onLeaveGame={handleLeaveGame}
          />
        )}
      </main>

      {/* Fixed 4-Tab Mobile Bottom Navigation */}
      <GameBottomNav
        activeTab={activeNavTab}
        photoCount={eventWallPhotos.length}
        playerCount={participants.length}
        onSelectTab={handleSelectNavTab}
      />

      {/* Challenge Selection / Gallery Preview / Submit Modal */}
      <ChallengePhotoModal
        challenge={selectedChallenge}
        existingPhoto={selectedChallenge ? photos[selectedChallenge.id] : undefined}
        isEventClosed={isEventClosed}
        onClose={() => setSelectedChallengeId(null)}
        onOpenCamera={handleOpenCamera}
        onSubmitProcessedPhoto={handleSubmitProcessedPhoto}
        onRemovePhoto={handleRemovePhoto}
      />

      {/* Live Camera Capture Modal */}
      <CameraCaptureModal
        challenge={cameraChallenge}
        onClose={() => setCameraChallengeId(null)}
        onConfirmPhoto={handleSubmitRawFile}
        onFallbackToGallery={(id) => {
          setCameraChallengeId(null);
          setSelectedChallengeId(id);
        }}
      />
    </div>
  );
}
