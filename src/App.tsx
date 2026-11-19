import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, RotateCcw, X } from 'lucide-react';
import { ChallengeCard } from './components/ChallengeCard';
import { CollageScreen } from './components/CollageScreen';
import { PhotoPreviewModal } from './components/PhotoPreviewModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { CHALLENGES, type ChallengePhotoMap } from './data/challenges';
import { processImageLocally } from './utils/imageProcessor';

const STORAGE_KEY = 'find-someone-who-9-photo-challenge-v1';

function loadSavedPhotos(): ChallengePhotoMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

export default function App() {
  const [photos, setPhotos] = useState<ChallengePhotoMap>(() => loadSavedPhotos());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewChallengeId, setPreviewChallengeId] = useState<number | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isCollageView, setIsCollageView] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    } catch {
      // Ignore storage quota errors in private browsing or constrained devices
    }
  }, [photos]);

  const uploadedCount = useMemo(
    () => CHALLENGES.filter((c) => Boolean(photos[c.id])).length,
    [photos],
  );

  const isAllUploaded = uploadedCount === CHALLENGES.length;
  const progressRatio = uploadedCount / CHALLENGES.length;

  const handleSelectFile = useCallback(async (challengeId: number, file: File) => {
    setErrorMessage(null);
    try {
      const processedPhoto = await processImageLocally(file);
      setPhotos((prev) => ({
        ...prev,
        [challengeId]: processedPhoto,
      }));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not load that image. Please use a JPG, JPEG, or PNG file.';
      setErrorMessage(message);
    }
  }, []);

  const handleRemovePhoto = useCallback((challengeId: number) => {
    setErrorMessage(null);
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[challengeId];
      return next;
    });
    setIsCollageView(false);
  }, []);

  const handleCreateCollage = useCallback(() => {
    if (!isAllUploaded) return;
    setPreviewChallengeId(null);
    setIsCollageView(true);
  }, [isAllUploaded]);

  const handleConfirmReset = useCallback(() => {
    setPhotos({});
    setErrorMessage(null);
    setPreviewChallengeId(null);
    setIsResetModalOpen(false);
    setIsCollageView(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const previewChallenge = useMemo(
    () => CHALLENGES.find((c) => c.id === previewChallengeId) ?? null,
    [previewChallengeId],
  );

  if (isCollageView && isAllUploaded) {
    return (
      <>
        <CollageScreen
          challenges={CHALLENGES}
          photos={photos}
          onBackToEdit={() => setIsCollageView(false)}
          onStartOver={() => setIsResetModalOpen(true)}
        />
        <ResetConfirmModal
          isOpen={isResetModalOpen}
          completedCount={uploadedCount}
          onCancel={() => setIsResetModalOpen(false)}
          onConfirm={handleConfirmReset}
        />
      </>
    );
  }

  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex flex-col items-center justify-center px-3 py-2.5 sm:px-6 sm:py-6">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-2xl flex flex-col">
        {/* Compact Corporate Networking Header */}
        <header className="text-center mb-2 sm:mb-4">
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#258A83]">
            NETWORKING ACTIVITY
          </p>
          <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-[#142B49] leading-tight mt-0.5">
            HUMAN BINGO
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-[#142B49]/85 mt-0.5">
            Meet people. Find connections.
          </p>
          <p className="text-[10.5px] sm:text-xs text-[#4F627A] leading-snug mt-0.5">
            Complete all 9 challenges by interacting with fellow participants.
          </p>
        </header>

        {/* Inline Validation Error (rendered only on invalid file) */}
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
              {uploadedCount}/{CHALLENGES.length} FILLED
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

        {/* Progress & Submit Section */}
        <footer className="mt-2.5 sm:mt-4 flex flex-col gap-2 sm:gap-2.5">
          <div className="rounded-xl sm:rounded-2xl bg-white border border-[#DCE3EC] px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_2px_8px_rgba(20,43,73,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs sm:text-sm font-bold text-[#142B49] whitespace-nowrap">
                  Your Progress
                </span>
                <span className="text-[#DCE3EC]" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ${
                    isAllUploaded ? 'text-[#258A83]' : 'text-[#4F627A]'
                  }`}
                >
                  {uploadedCount}/{CHALLENGES.length} uploaded
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                disabled={uploadedCount === 0}
                className="px-2.5 py-1 rounded-lg border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-[11px] sm:text-xs font-semibold text-[#142B49]/80 hover:text-[#142B49] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#258A83] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>

            {/* Refined Progress Bar */}
            <div
              className="mt-2 w-full h-1.5 rounded-full bg-[#E6ECF3] overflow-hidden"
              role="progressbar"
              aria-valuenow={uploadedCount}
              aria-valuemin={0}
              aria-valuemax={CHALLENGES.length}
              aria-label={`${uploadedCount} of ${CHALLENGES.length} photos uploaded`}
            >
              <div
                className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#258A83] to-[#142B49] transition-transform duration-200"
                style={{ transform: `scaleX(${progressRatio})` }}
              />
            </div>
          </div>

          {/* Prominent Submit & Create Collage Button */}
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
        isOpen={isResetModalOpen}
        completedCount={uploadedCount}
        onCancel={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
      />
    </div>
  );
}
