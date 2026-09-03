import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { moralNode } from '../core/MoralNode';
import { evolis } from '../core/EVOLIS';
import { PerceptionEngine, PerceptionData } from '../core/PerceptionEngine';

export interface Detection {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

export interface RealModeSensorsState {
  loading: boolean;
  error: string | null;
  detections: Detection[];
  perception: PerceptionData | null;
  lastEval: { allowed: boolean; reason: string } | null;
}

export function useRealModeSensors(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean,
  intervalMs: number = 5000
): RealModeSensorsState {
  const [state, setState] = useState<RealModeSensorsState>({
    loading: true, error: null, detections: [], perception: null, lastEval: null,
  });
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const intervalRef = useRef<number | null>(null);
  const perceptionEngine = useRef(new PerceptionEngine());

  useEffect(() => {
    let cancelled = false;
    async function loadModel() {
      try {
        await tf.ready();
        await tf.setBackend('webgl');
        const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        if (cancelled) return;
        modelRef.current = model;
        setState((s) => ({ ...s, loading: false }));
      } catch (err) {
        setState((s) => ({
          ...s, loading: false,
          error: err instanceof Error ? err.message : 'Error loading model',
        }));
      }
    }
    loadModel();
    return () => {
      cancelled = true;
      if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!active || state.loading || !modelRef.current) return;

    async function detect() {
      const video = videoRef.current;
      const model = modelRef.current;
      if (!video || !model || video.readyState < 2) return;
      try {
        const predictions = await model.detect(video);
        const detections: Detection[] = predictions.map((p) => ({
          class: p.class, score: p.score, bbox: p.bbox as [number, number, number, number],
        }));
        const perception = perceptionEngine.current.process({ visionDetections: detections });
        const eval_ = moralNode.evaluate(`detect: ${detections.map((d) => d.class).join(', ')}`);
        if (eval_.allowed && detections.length > 0) {
          await evolis.record('vision', 'detection', JSON.stringify(detections.slice(0, 3)));
        }
        setState((s) => ({
          ...s, detections, perception,
          lastEval: { allowed: eval_.allowed, reason: eval_.decisions.find((d) => !d.passed)?.reason ?? 'OK' },
        }));
      } catch {
        // Detection errors are transient
      }
    }
    detect();
    intervalRef.current = window.setInterval(detect, intervalMs);
    return () => {
      if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [active, state.loading, intervalMs, videoRef]);

  return state;
}
