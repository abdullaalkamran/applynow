import { useEffect, useRef, type MutableRefObject } from "react";

/** Live microphone loudness (0–1, smoothed) in a ref — read it inside an animation loop so the orb can react to the
 * voice without re-rendering React 60 times a second. Opens its own read-only stream (the mic permission was already
 * granted for the conversation) and closes it the moment `enabled` turns false. Silent and harmless if unavailable. */
export function useMicLevel(enabled: boolean): MutableRefObject<number> {
  const level = useRef(0);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      level.current = 0;
      return;
    }
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | undefined;
    let ctx: AudioContext | undefined;

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / data.length);
          // Fast attack, slow release so the orb swells with each word and settles smoothly.
          const target = Math.min(1, rms * 5);
          level.current += (target - level.current) * (target > level.current ? 0.5 : 0.08);
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => { /* no mic / denied — the orb just stays calm */ });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => undefined);
      level.current = 0;
    };
  }, [enabled]);

  return level;
}
