import { useEffect, useRef, useState } from 'react';
import { deviceManager } from '../core/DeviceManager';
import { Detection } from '../hooks/useRealModeSensors';

interface CameraStreamProps {
  active: boolean;
  detections: Detection[];
  onVideoReady?: (video: HTMLVideoElement) => void;
}

export function CameraStream({ active, detections, onVideoReady }: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      const video = videoRef.current;
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
        setStreaming(false);
      }
      return;
    }
    let cancelled = false;
    deviceManager.requestCamera().then((stream) => {
      if (cancelled || !stream || !videoRef.current) {
        if (!stream) setError('No se pudo acceder a la camara');
        return;
      }
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setStreaming(true);
      onVideoReady?.(videoRef.current);
    });
    return () => {
      cancelled = true;
      const video = videoRef.current;
      if (video && video.srcObject) {
        const s = video.srcObject as MediaStream;
        s.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
    };
  }, [active, onVideoReady]);

  useEffect(() => {
    if (!streaming || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    function draw() {
      if (!video || !canvas || !ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const det of detections) {
        const [x, y, w, h] = det.bbox;
        ctx.strokeStyle = det.class === 'person' ? '#00d4ff' : '#00ff88';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        const label = `${det.class} ${Math.round(det.score * 100)}%`;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y - 22, ctx.measureText(label).width + 10, 22);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.fillText(label, x + 5, y - 7);
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [streaming, detections]);

  if (!active) return null;

  return (
    <div className="camera-stream">
      {error && <div className="camera-error">{error}</div>}
      <video ref={videoRef} autoPlay playsInline muted aria-label="Transmision de camara en vivo" />
      <canvas ref={canvasRef} className="detection-overlay" aria-hidden="true" />
      {streaming && detections.length > 0 && (
        <div className="detection-list" aria-live="polite">
          {detections.slice(0, 5).map((d, i) => (
            <div key={i} className="detection-item">
              <span className="detection-class">{d.class}</span>
              <span className="detection-score">{Math.round(d.score * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
