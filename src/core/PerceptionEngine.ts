import type { BioState } from './BioSoftwareInterface';

export interface PerceptionData {
  vision: {
    objects: { class: string; score: number; bbox: [number, number, number, number] }[];
    personCount: number;
    description: string;
    camouflageDetected: boolean;
    camouflageDetails: string[];
    lowConfidenceFiltered: number;
  } | null;
  audio: { level: number; detected: boolean } | null;
  imu: {
    accelerometer: { x: number; y: number; z: number } | null;
    gyroscope: { x: number; y: number; z: number } | null;
    orientation: { alpha: number; beta: number; gamma: number } | null;
  } | null;
  stf: { skinTemp: number | null; ambientTemp: number | null; flux: number | null } | null;
  gps: {
    latitude: number; longitude: number; accuracy: number;
    speed: number | null; heading: number | null;
  } | null;
  timestamp: number;
}

export interface PerceptionInput {
  visionDetections?: { class: string; score: number; bbox: [number, number, number, number] }[];
  audioLevel?: number;
  imuReading?: {
    accelerometer: { x: number; y: number; z: number } | null;
    gyroscope: { x: number; y: number; z: number } | null;
    orientation: { alpha: number; beta: number; gamma: number } | null;
  };
  stfReading?: { skinTemp: number | null; ambientTemp: number | null; flux: number | null };
  gpsReading?: {
    latitude: number; longitude: number; accuracy: number;
    speed: number | null; heading: number | null;
  };
  imageWidth?: number;
  imageHeight?: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

const PARANORMAL_CLASSES = new Set([
  'person', 'face', 'clock', 'vase', 'teddy bear', 'bottle',
]);

export interface PerceptionSensitivity {
  confidenceThreshold: number;
  enableCamouflageDetection: boolean;
  contextLabel: string;
}

export class PerceptionEngine {
  private sensitivity: PerceptionSensitivity = {
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    enableCamouflageDetection: true,
    contextLabel: 'Normal',
  };

  setBioContext(bioState: BioState): void {
    const stress = bioState.stressLevel;
    const focus = bioState.focusLevel;
    const coherence = bioState.cardiacCoherence;

    if (stress > 0.7) {
      this.sensitivity = {
        confidenceThreshold: 0.8,
        enableCamouflageDetection: true,
        contextLabel: 'Alerta por estrés — umbral elevado',
      };
    } else if (focus > 0.75 && coherence > 0.7) {
      this.sensitivity = {
        confidenceThreshold: 0.55,
        enableCamouflageDetection: true,
        contextLabel: 'Enfoque alto — sensibilidad aumentada',
      };
    } else if (coherence > 0.6) {
      this.sensitivity = {
        confidenceThreshold: 0.6,
        enableCamouflageDetection: true,
        contextLabel: 'Coherencia alta — percepción optimizada',
      };
    } else {
      this.sensitivity = {
        confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
        enableCamouflageDetection: true,
        contextLabel: 'Normal',
      };
    }
  }

  getSensitivity(): PerceptionSensitivity {
    return { ...this.sensitivity };
  }

  process(input: PerceptionInput): PerceptionData {
    const timestamp = Date.now();

    let vision: PerceptionData['vision'] = null;
    if (input.visionDetections && input.visionDetections.length > 0) {
      const threshold = this.sensitivity.confidenceThreshold;
      const filtered = this.applyAntiParaidolia(input.visionDetections, threshold);
      const personCount = filtered.filter((d) => d.class === 'person').length;
      const topObjects = filtered.slice(0, 5);

      let camouflageDetected = false;
      let camouflageDetails: string[] = [];
      if (this.sensitivity.enableCamouflageDetection && input.imageWidth && input.imageHeight) {
        const camo = this.detectCamouflage(filtered, input.imageWidth, input.imageHeight);
        camouflageDetected = camo.detected;
        camouflageDetails = camo.details;
      }

      const description = this.describeScene(topObjects, personCount, camouflageDetected, camouflageDetails);
      vision = {
        objects: topObjects,
        personCount,
        description,
        camouflageDetected,
        camouflageDetails,
        lowConfidenceFiltered: input.visionDetections.length - filtered.length,
      };
    }

    let audio: PerceptionData['audio'] = null;
    if (input.audioLevel !== undefined) {
      audio = { level: input.audioLevel, detected: input.audioLevel > 0.1 };
    }

    return {
      vision, audio,
      imu: input.imuReading ?? null,
      stf: input.stfReading ?? null,
      gps: input.gpsReading ?? null,
      timestamp,
    };
  }

  private applyAntiParaidolia(
    detections: { class: string; score: number; bbox: [number, number, number, number] }[],
    threshold: number
  ): { class: string; score: number; bbox: [number, number, number, number] }[] {
    return detections.filter((d) => {
      if (d.score < threshold) return false;

      const [x, y, w, h] = d.bbox;
      const area = w * h;
      if (area < 500) return false;

      const aspectRatio = w / Math.max(h, 1);
      if (aspectRatio > 10 || aspectRatio < 0.05) return false;

      if (PARANORMAL_CLASSES.has(d.class) && d.score < threshold + 0.1) {
        return false;
      }

      return true;
    });
  }

  private detectCamouflage(
    detections: { class: string; score: number; bbox: [number, number, number, number] }[],
    imgW: number,
    imgH: number
  ): { detected: boolean; details: string[] } {
    const details: string[] = [];
    const imgArea = imgW * imgH;

    for (let i = 0; i < detections.length; i++) {
      const d = detections[i];
      const [x, y, w, h] = d.bbox;
      const detArea = w * h;
      const coverageRatio = detArea / imgArea;

      if (coverageRatio > 0.6) {
        details.push(`${d.class} ocupa ${Math.round(coverageRatio * 100)}% de la escena — posible ocultación`);
      }

      if (w < 30 || h < 30) {
        details.push(`${d.class} con dimensiones reducidas (${Math.round(w)}x${Math.round(h)}) — posible objeto parcialmente oculto`);
      }

      for (let j = i + 1; j < detections.length; j++) {
        const other = detections[j];
        const overlap = this.bboxOverlap(d.bbox, other.bbox);
        if (overlap > 0.4) {
          const smaller = detArea < other.bbox[2] * other.bbox[3] ? d.class : other.class;
          details.push(`${smaller} parcialmente oculto por solapación (${Math.round(overlap * 100)}%)`);
        }
      }
    }

    return { detected: details.length > 0, details };
  }

  private bboxOverlap(a: [number, number, number, number], b: [number, number, number, number]): number {
    const [ax, ay, aw, ah] = a;
    const [bx, by, bw, bh] = b;
    const overlapW = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
    const overlapH = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
    const overlapArea = overlapW * overlapH;
    const areaA = aw * ah;
    const areaB = bw * bh;
    const minArea = Math.min(areaA, areaB);
    return minArea > 0 ? overlapArea / minArea : 0;
  }

  private describeScene(
    objects: { class: string; score: number }[],
    personCount: number,
    camouflageDetected: boolean,
    camouflageDetails: string[]
  ): string {
    const parts: string[] = [];
    if (personCount > 0) {
      parts.push(
        personCount === 1 ? 'Una persona detectada' : `${personCount} personas detectadas`
      );
    }
    const nonPersons = objects.filter((o) => o.class !== 'person');
    if (nonPersons.length > 0) {
      const labels = nonPersons.map((o) => o.class).join(', ');
      parts.push(`Objetos: ${labels}`);
    }
    if (camouflageDetected && camouflageDetails.length > 0) {
      parts.push(`Atención: ${camouflageDetails[0]}`);
    }
    return parts.length > 0 ? parts.join('. ') : 'Escena sin objetos significativos';
  }

  summarize(perception: PerceptionData): string {
    const parts: string[] = [];
    if (perception.vision) {
      parts.push(perception.vision.description);
      if (perception.vision.lowConfidenceFiltered > 0) {
        parts.push(`${perception.vision.lowConfidenceFiltered} detecciones filtradas por baja confianza`);
      }
    }
    if (perception.audio?.detected) parts.push('Audio detectado');
    if (perception.imu?.orientation) {
      const o = perception.imu.orientation;
      parts.push(`Orientación: ${Math.round(o.alpha)} grados`);
    }
    if (perception.gps) {
      parts.push(`GPS: ${perception.gps.latitude.toFixed(4)}, ${perception.gps.longitude.toFixed(4)}`);
    }
    if (perception.stf?.skinTemp !== null && perception.stf?.skinTemp !== undefined) {
      parts.push(`Temp. piel: ${perception.stf.skinTemp} C`);
    }
    return parts.length > 0 ? parts.join('. ') : 'Sin datos sensoriales';
  }
}

export const perceptionEngine = new PerceptionEngine();
