export interface PerceptionData {
  vision: {
    objects: { class: string; score: number; bbox: [number, number, number, number] }[];
    personCount: number;
    description: string;
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
}

export class PerceptionEngine {
  process(input: PerceptionInput): PerceptionData {
    const timestamp = Date.now();

    let vision: PerceptionData['vision'] = null;
    if (input.visionDetections && input.visionDetections.length > 0) {
      const personCount = input.visionDetections.filter((d) => d.class === 'person').length;
      const topObjects = input.visionDetections.slice(0, 5);
      const description = this.describeScene(topObjects, personCount);
      vision = { objects: topObjects, personCount, description };
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

  private describeScene(
    objects: { class: string; score: number }[],
    personCount: number
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
    return parts.length > 0 ? parts.join('. ') : 'Escena sin objetos significativos';
  }

  summarize(perception: PerceptionData): string {
    const parts: string[] = [];
    if (perception.vision) parts.push(perception.vision.description);
    if (perception.audio?.detected) parts.push('Audio detectado');
    if (perception.imu?.orientation) {
      const o = perception.imu.orientation;
      parts.push(`Orientacion: ${Math.round(o.alpha)} grados`);
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
