import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { VoiceConversationState } from "../../utils/useVoiceConversation";
import { VERT, FRAG } from "./voiceOrbShader";
import "./VoiceOrb.css";

const RIBBON_A = "M-20 130 C 40 70, 90 70, 140 120 S 240 185, 320 120";
const RIBBON_B = "M-20 190 C 50 130, 110 135, 160 175 S 260 235, 320 175";
const RIBBON_C = "M-20 95 C 50 40, 110 45, 165 85 S 255 125, 320 70";

// How fast the flow field moves, and how much energy it carries, per conversation state.
const STATE_MOTION: Record<VoiceConversationState, { speed: number; energy: number }> = {
  idle: { speed: 0.45, energy: 0.05 },
  listening: { speed: 0.9, energy: 0.12 },
  thinking: { speed: 2.6, energy: 0.55 },
  speaking: { speed: 1.5, energy: 0.5 },
  error: { speed: 0.3, energy: 0 },
};

/** Renders the shader orb into a canvas. Returns false if WebGL isn't available so the caller can fall back. */
function useShaderOrb(canvasRef: MutableRefObject<HTMLCanvasElement | null>, state: VoiceConversationState, level: MutableRefObject<number> | undefined, size: number) {
  const [ok, setOk] = useState(true);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) { console.warn("Voice orb: WebGL unavailable, using the CSS orb."); setOk(false); return; }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
      console.warn("Voice orb shader failed to compile:", gl.getShaderInfoLog(sh));
      return null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    if (!vs || !fs) { setOk(false); return; }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setOk(false); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const uTime = gl.getUniformLocation(prog, "uTime");
    const uEnergy = gl.getUniformLocation(prog, "uEnergy");
    const uGray = gl.getUniformLocation(prog, "uGray");
    const uPx = gl.getUniformLocation(prog, "uPx");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(size * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uPx, 2 / canvas.width);

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let phase = 4;
    let energy = 0;
    let gray = 0;
    let last = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const st = stateRef.current;
      const m = STATE_MOTION[st];
      // Voice level drives the orb while listening; speech has no measurable level here, so it breathes instead.
      let target = m.energy;
      if (st === "listening") target += (level?.current ?? 0) * 1.1;
      if (st === "speaking") target += 0.28 * (0.5 + 0.5 * Math.sin(now / 130)) * (0.6 + 0.4 * Math.sin(now / 410));
      energy += (target - energy) * Math.min(1, dt * 7);
      gray += ((st === "error" ? 0.9 : 0) - gray) * Math.min(1, dt * 4);
      phase += dt * m.speed * (1 + energy * 0.6);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, phase);
      gl.uniform1f(uEnergy, energy);
      gl.uniform1f(uGray, gray);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // No loseContext() here: React's dev double-mount re-runs this effect on the same canvas, and a context we just
    // killed would be handed straight back. The canvas is discarded on unmount, which releases its context.
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, level, size]);

  return ok;
}

/** The glowing glass orb — a GPU-shaded sphere of flowing light. It drifts calmly while listening (and swells with
 * the speaker's voice when `level` is given), whirls while thinking and breathes while speaking. Falls back to a
 * lighter CSS version where WebGL isn't available. Purely visual: it never touches the microphone itself. */
export function VoiceOrb({ state, size = 260, level, floor = true }: { state: VoiceConversationState; size?: number; level?: MutableRefObject<number>; floor?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webgl = useShaderOrb(canvasRef, state, level, size);

  return (
    <div className="vorb" data-state={state} style={{ ["--vorb-size" as string]: `${size}px` }} aria-hidden="true">
      <div className="vorb-halo" />
      {webgl ? (
        <canvas ref={canvasRef} className="vorb-canvas" />
      ) : (
        <div className="vorb-sphere">
          <span className="vorb-blob b0" />
          <span className="vorb-blob b1" />
          <span className="vorb-blob b2" />
          <span className="vorb-blob b3" />
          <span className="vorb-blob b4" />
          <svg className="vorb-ribbons" viewBox="0 0 300 300" fill="none">
            <path d={RIBBON_A} stroke="rgba(235,248,255,0.95)" strokeWidth="4" strokeLinecap="round" />
            <path d={RIBBON_B} stroke="rgba(120,190,255,0.85)" strokeWidth="16" strokeLinecap="round" opacity="0.55" />
          </svg>
          <svg className="vorb-ribbons r2" viewBox="0 0 300 300" fill="none">
            <path d={RIBBON_C} stroke="rgba(255,225,195,0.95)" strokeWidth="4" strokeLinecap="round" />
            <path d={RIBBON_B} stroke="rgba(255,140,200,0.85)" strokeWidth="14" strokeLinecap="round" opacity="0.5" />
          </svg>
          <div className="vorb-gloss" />
        </div>
      )}
      {floor && <div className="vorb-floor" />}
    </div>
  );
}
