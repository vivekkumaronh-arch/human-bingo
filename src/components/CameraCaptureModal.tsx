import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  SwitchCamera,
  X,
} from 'lucide-react';
import type { ChallengeItem } from '../data/challenges';

interface CameraCaptureModalProps {
  challenge: ChallengeItem | null;
  onClose: () => void;
  onConfirmPhoto: (challengeId: number, file: File) => Promise<void>;
  onFallbackToGallery: (challengeId: number) => void;
}

interface CapturedPreview {
  file: File;
  objectUrl: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  challenge,
  onClose,
  onConfirmPhoto,
  onFallbackToGallery,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestSeqRef = useRef(0);
  const isMountedRef = useRef(true);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CapturedPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const revokeCapturedPreview = useCallback((preview: CapturedPreview | null) => {
    if (preview?.objectUrl) {
      URL.revokeObjectURL(preview.objectUrl);
    }
  }, []);

  const startCamera = useCallback(
    async (preferredDeviceId?: string) => {
      const requestId = ++requestSeqRef.current;
      stopTracks();
      setCameraError(null);
      setUploadError(null);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setCameraError(
          'Live camera capture is not supported in this browser or context. Please use Choose from Gallery instead.',
        );
        return;
      }

      setIsStartingCamera(true);
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: preferredDeviceId
              ? { deviceId: { exact: preferredDeviceId } }
              : {
                  facingMode: { ideal: 'environment' },
                  width: { ideal: 1280 },
                  height: { ideal: 1280 },
                },
            audio: false,
          });
        } catch (constraintErr) {
          // Fallback to generic video constraint if ideal environment/device constraint fails
          if (
            constraintErr instanceof DOMException &&
            (constraintErr.name === 'OverconstrainedError' ||
              constraintErr.name === 'ConstraintNotSatisfiedError')
          ) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } else {
            throw constraintErr;
          }
        }

        // If modal closed or another startCamera call superseded this one, release immediately
        if (!isMountedRef.current || requestId !== requestSeqRef.current) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;

        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = stream;
          try {
            await videoEl.play();
          } catch {
            // Autoplay promise can resolve/reject harmlessly while metadata loads
          }
        }

        // Populate available video devices now that permission has been granted
        if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            if (isMountedRef.current && requestId === requestSeqRef.current) {
              const inputs = devices.filter((d) => d.kind === 'videoinput');
              setVideoDevices(inputs);

              const activeTrack = stream.getVideoTracks()[0];
              const activeDeviceId = activeTrack?.getSettings()?.deviceId;
              if (activeDeviceId) {
                setSelectedDeviceId(activeDeviceId);
              } else if (inputs[0]?.deviceId && !preferredDeviceId) {
                setSelectedDeviceId(inputs[0].deviceId);
              }
            }
          } catch {
            // Device enumeration optional
          }
        }
      } catch (err) {
        if (!isMountedRef.current || requestId !== requestSeqRef.current) return;
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraError(
              'Camera permission was denied. Please allow camera access in your browser settings or choose a photo from your gallery.',
            );
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setCameraError(
              'No camera device was detected on this device. Please choose a photo from your gallery.',
            );
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            setCameraError(
              'Your camera is currently in use by another app. Close the other app and tap Retry, or use Choose from Gallery.',
            );
          } else {
            setCameraError(
              err.message || 'Could not start the camera. Please try again or use gallery.',
            );
          }
        } else {
          setCameraError('Could not access the camera. Please use Choose from Gallery.');
        }
      } finally {
        if (isMountedRef.current && requestId === requestSeqRef.current) {
          setIsStartingCamera(false);
        }
      }
    },
    [stopTracks],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestSeqRef.current += 1;
      stopTracks();
    };
  }, [stopTracks]);

  useEffect(() => {
    if (!challenge) {
      requestSeqRef.current += 1;
      stopTracks();
      setCaptured((prev) => {
        revokeCapturedPreview(prev);
        return null;
      });
      setCameraError(null);
      setUploadError(null);
      setIsUploading(false);
      return;
    }

    setCaptured((prev) => {
      revokeCapturedPreview(prev);
      return null;
    });
    setSelectedDeviceId('');
    setVideoDevices([]);
    void startCamera();

    return () => {
      requestSeqRef.current += 1;
      stopTracks();
    };
  }, [challenge, revokeCapturedPreview, startCamera, stopTracks]);

  useEffect(() => {
    if (!challenge) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [challenge, isUploading, onClose]);

  if (!challenge) return null;

  const handleCaptureFrame = () => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      setCameraError('Camera frame is not ready yet. Please wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Could not capture photograph in this browser.');
      return;
    }

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Could not encode captured photograph. Please try again.');
          return;
        }
        const file = new File([blob], `challenge-${challenge.id}-live.jpg`, {
          type: 'image/jpeg',
        });
        const objectUrl = URL.createObjectURL(blob);

        // Stop hardware camera immediately once frame is captured
        stopTracks();
        setCaptured((prev) => {
          revokeCapturedPreview(prev);
          return { file, objectUrl };
        });
        setUploadError(null);
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleRetake = () => {
    if (isUploading) return;
    setCaptured((prev) => {
      revokeCapturedPreview(prev);
      return null;
    });
    setUploadError(null);
    void startCamera(selectedDeviceId || undefined);
  };

  const handleUsePhoto = async () => {
    if (!captured || isUploading) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      stopTracks();
      await onConfirmPhoto(challenge.id, captured.file);
      revokeCapturedPreview(captured);
      setCaptured(null);
      onClose();
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Could not upload photograph. Please try again.',
      );
    } finally {
      if (isMountedRef.current) {
        setIsUploading(false);
      }
    }
  };

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    void startCamera(deviceId);
  };

  const handleSwitchCamera = () => {
    if (videoDevices.length < 2) return;
    const idx = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const next = videoDevices[(idx + 1) % videoDevices.length];
    if (next) {
      handleDeviceSelect(next.deviceId);
    }
  };

  const handleCancel = () => {
    if (isUploading) return;
    stopTracks();
    revokeCapturedPreview(captured);
    setCaptured(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-capture-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#142B49]/75 backdrop-blur-xs"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white border border-[#DCE3EC] shadow-2xl overflow-hidden text-[#142B49]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[#DCE3EC] bg-[#FBF6EE]">
          <div className="min-w-0">
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#258A83] tabular-nums">
              {challenge.numberLabel} · {challenge.headline}
            </span>
            <h3
              id="camera-capture-title"
              className="text-sm sm:text-base font-bold text-[#142B49] leading-snug mt-0.5"
            >
              {captured ? 'Review Captured Photograph' : 'Capture Live Photo'}
            </h3>
            <p className="text-xs text-[#4F627A] mt-0.5 line-clamp-2">{challenge.prompt}</p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUploading}
            aria-label="Close camera"
            className="min-w-[38px] min-h-[38px] -mr-1 -mt-0.5 rounded-xl text-[#5D7088] hover:text-[#142B49] hover:bg-white/80 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Camera Selector (when multiple cameras are available on desktop/mobile) */}
        {!captured && videoDevices.length > 1 && !cameraError && (
          <div className="px-4 py-2 bg-[#F5F7FA] border-b border-[#DCE3EC] flex items-center justify-between gap-2">
            <label
              htmlFor="camera-device-select"
              className="text-[11px] font-semibold text-[#4F627A] shrink-0"
            >
              Camera
            </label>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <select
                id="camera-device-select"
                value={selectedDeviceId}
                onChange={(e) => handleDeviceSelect(e.target.value)}
                disabled={isStartingCamera}
                className="flex-1 min-w-0 rounded-lg border border-[#DCE3EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#142B49] focus:outline-none focus:border-[#258A83]"
              >
                {videoDevices.map((device, idx) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSwitchCamera}
                disabled={isStartingCamera}
                title="Switch camera"
                aria-label="Switch camera"
                className="p-1.5 rounded-lg border border-[#DCE3EC] bg-white hover:bg-[#EAEFF6] text-[#142B49] cursor-pointer shrink-0"
              >
                <SwitchCamera className="w-4 h-4 text-[#258A83]" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Viewport / Preview */}
        <div className="p-4 bg-[#142B49] relative">
          {captured ? (
            <div className="w-full aspect-square max-h-[55vh] mx-auto rounded-xl overflow-hidden bg-black/40 border border-white/15 flex items-center justify-center">
              <img
                src={captured.objectUrl}
                alt={`Captured preview for ${challenge.headline}`}
                className="w-full h-full object-contain"
              />
            </div>
          ) : cameraError ? (
            <div className="w-full min-h-[260px] rounded-xl bg-[#0F223A] border border-white/15 p-5 flex flex-col items-center justify-center text-center gap-3 text-white">
              <div className="w-11 h-11 rounded-2xl bg-[#E25546]/20 border border-[#E25546]/40 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-[#F59A8E]" aria-hidden="true" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-white/90 max-w-xs leading-relaxed">
                {cameraError}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => void startCamera(selectedDeviceId || undefined)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Retry Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = challenge.id;
                    handleCancel();
                    onFallbackToGallery(targetId);
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Choose from Gallery</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-full aspect-square max-h-[55vh] mx-auto rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {isStartingCamera && (
                <div className="absolute inset-0 bg-[#142B49]/75 flex flex-col items-center justify-center gap-2 text-white">
                  <Loader2 className="w-6 h-6 animate-spin text-[#8CE0D9]" aria-hidden="true" />
                  <span className="text-xs font-semibold">Starting camera…</span>
                </div>
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-4 rounded-xl border border-white/25"
              />
            </div>
          )}

          {uploadError && (
            <div
              role="alert"
              className="mt-3 rounded-xl bg-[#FDF5F3] border border-[#F08B76]/60 px-3 py-2 flex items-center gap-2 text-xs font-medium text-[#A63A24]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#D96D57]" aria-hidden="true" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Controls Footer */}
        <div className="p-4 bg-white border-t border-[#DCE3EC]">
          {captured ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={handleUsePhoto}
                disabled={isUploading}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors shadow-[0_3px_10px_rgba(37,138,131,0.24)]"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                    <span>Uploading…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Submit Photo</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRetake}
                disabled={isUploading}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#DCE3EC] bg-white hover:bg-[#F5F7FA] text-[#142B49] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-[#258A83] shrink-0" aria-hidden="true" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={isUploading}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-[#4F627A] text-xs sm:text-sm font-semibold inline-flex items-center justify-center cursor-pointer disabled:opacity-50 transition-colors"
              >
                <span>Cancel</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#DCE3EC] bg-[#F5F7FA] hover:bg-[#EAEFF6] text-[#4F627A] text-xs sm:text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCaptureFrame}
                disabled={isStartingCamera || Boolean(cameraError)}
                className="flex-1 min-h-[46px] px-5 py-2.5 rounded-xl bg-[#258A83] hover:bg-[#1E726C] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-colors shadow-[0_4px_14px_rgba(37,138,131,0.28)]"
              >
                <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Capture</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
