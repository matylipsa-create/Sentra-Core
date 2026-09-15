import type { Detection } from './spatialTranslator';

function iou(a: [number, number, number, number], b: [number, number, number, number]): number {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = aw * ah + bw * bh - inter;
  return union > 0 ? inter / union : 0;
}

export function applyNMS(detections: Detection[], iouThreshold = 0.5): Detection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const result: Detection[] = [];
  for (const det of sorted) {
    const overlaps = result.some((r) => r.class === det.class && iou(r.bbox, det.bbox) > iouThreshold);
    if (!overlaps) result.push(det);
  }
  return result;
}

export function filterByConfidence(detections: Detection[], minScore = 0.55): Detection[] {
  return detections.filter((d) => d.score >= minScore);
}

const INDOOR_ONLY_LABELS = ['tie', 'toothbrush', 'hair drier', 'teddy bear'];

export function filterByContext(detections: Detection[], context: 'indoor' | 'outdoor' | 'any' = 'any'): Detection[] {
  if (context === 'indoor' || context === 'any') return detections;
  return detections.filter((d) => !INDOOR_ONLY_LABELS.includes(d.class));
}

export function refineDetections(detections: Detection[], context: 'indoor' | 'outdoor' | 'any' = 'outdoor'): Detection[] {
  let refined = filterByConfidence(detections, 0.55);
  refined = filterByContext(refined, context);
  refined = applyNMS(refined, 0.5);
  return refined;
}
