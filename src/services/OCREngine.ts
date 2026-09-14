import { createWorker, type Worker } from 'tesseract.js';

let worker: Worker | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

export async function initOCR(): Promise<void> {
  if (worker) return;
  if (isInitializing && initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      worker = await createWorker('spa', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Progreso: ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      console.log('[OCR] Worker inicializado (español)');
    } catch (err) {
      console.error('[OCR] Error al inicializar:', err);
      worker = null;
      throw err;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

export async function recognizeText(imageSource: HTMLVideoElement | HTMLCanvasElement | ImageData): Promise<string> {
  if (!worker) {
    await initOCR();
  }
  if (!worker) {
    throw new Error('OCR worker no disponible');
  }

  try {
    const result = await worker.recognize(imageSource as never);
    const text = result.data.text.trim();
    return text;
  } catch (err) {
    console.error('[OCR] Error al reconocer texto:', err);
    throw err;
  }
}

export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    console.log('[OCR] Worker terminado');
  }
}

export function isOCRReady(): boolean {
  return worker !== null;
}
