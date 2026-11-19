import type { UploadedPhoto } from '../data/challenges';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png)$/i;
const MAX_DIMENSION = 960;

export function isSupportedImageFile(file: File): boolean {
  const mime = file.type.toLowerCase().trim();
  if (mime && ALLOWED_MIME_TYPES.has(mime)) {
    return true;
  }
  if (!mime && ALLOWED_EXTENSIONS.test(file.name)) {
    return true;
  }
  // Some mobile browsers report uppercase or missing mime while filename matches
  if (ALLOWED_EXTENSIONS.test(file.name) && (!mime || mime.startsWith('image/'))) {
    return mime === '' || ALLOWED_MIME_TYPES.has(mime);
  }
  return false;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected image file.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the image file locally.'));
    };
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the selected image.'));
    img.src = src;
  });
}

export async function processImageLocally(file: File): Promise<UploadedPhoto> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Only JPG, JPEG, and PNG images are supported.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const isPng =
    file.type.toLowerCase() === 'image/png' || /\.png$/i.test(file.name);

  try {
    const img = await loadImageElement(rawDataUrl);
    const { naturalWidth, naturalHeight } = img;

    if (!naturalWidth || !naturalHeight) {
      return {
        dataUrl: rawDataUrl,
        fileName: file.name || 'challenge-photo.jpg',
        updatedAt: Date.now(),
      };
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        dataUrl: rawDataUrl,
        fileName: file.name || 'challenge-photo.jpg',
        updatedAt: Date.now(),
      };
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const compressedUrl = isPng
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.84);

    // If PNG output happens to be larger than raw and didn't resize, keep smaller one
    const finalDataUrl =
      scale === 1 && compressedUrl.length > rawDataUrl.length
        ? rawDataUrl
        : compressedUrl;

    return {
      dataUrl: finalDataUrl,
      fileName: file.name || (isPng ? 'challenge-photo.png' : 'challenge-photo.jpg'),
      updatedAt: Date.now(),
    };
  } catch {
    return {
      dataUrl: rawDataUrl,
      fileName: file.name || 'challenge-photo.jpg',
      updatedAt: Date.now(),
    };
  }
}
