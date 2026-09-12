import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio, synthesizeSpeech } from "./voiceClient";
import type { VoiceConversationState } from "./useVoiceConversation";

const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_DURATION_MS = 1200;
const MAX_RECORDING_MS = 20_000;

/**
 * Real-voice alternative to useVoiceConversation: records actual audio (MediaRecorder), transcribes
 * it via OpenAI Whisper, runs the transcript through the same replyFn as typed/browser-speech chat,
 * then plays OpenAI TTS audio for the reply — same {state, caption, errorText, start, stop} shape
 * so it's a drop-in swap. Auto-stops recording after ~1.2s of silence (with a hard time cap), then
 * loops back into listening once the reply finishes playing, for the same hands-free UX.
 */
export function useRealVoiceConversation(
  replyFn: (text: string) => Promise<string>,
  onExchange?: (userText: string, aiText: string) => void
) {
  const [state, setState] = useState<VoiceConversationState>("idle");
  const [caption, setCaption] = useState("");
  const [errorText, setErrorText] = useState("");

  const activeRef = useRef(false);
  const replyFnRef = useRef(replyFn);
  const onExchangeRef = useRef(onExchange);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const runCycleRef = useRef<() => void>(() => {});

  useEffect(() => { replyFnRef.current = replyFn; }, [replyFn]);
  useEffect(() => { onExchangeRef.current = onExchange; }, [onExchange]);

  const teardownRecording = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const runRecordCycle = useCallback(async () => {
    if (!activeRef.current) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("error");
      setErrorText("Microphone access was blocked — allow it in your browser settings to talk.");
      activeRef.current = false;
      return;
    }
    if (!activeRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;
    setState("listening");
    setCaption("Listening…");
    setErrorText("");

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.fftSize);

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const stopTimer = window.setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_RECORDING_MS);

    let speechDetected = false;
    let silenceStart: number | null = null;
    function watchSilence() {
      if (!activeRef.current || recorder.state !== "recording") return;
      analyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const now = performance.now();
      if (rms > SILENCE_RMS_THRESHOLD) {
        speechDetected = true;
        silenceStart = null;
      } else if (speechDetected) {
        if (silenceStart === null) silenceStart = now;
        else if (now - silenceStart > SILENCE_DURATION_MS) {
          recorder.stop();
          return;
        }
      }
      requestAnimationFrame(watchSilence);
    }

    recorder.onstop = async () => {
      window.clearTimeout(stopTimer);
      teardownRecording();
      if (!activeRef.current) return;

      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (!speechDetected || blob.size < 2000) {
        runCycleRef.current();
        return;
      }

      setState("thinking");
      setCaption("Thinking…");
      try {
        const transcript = await transcribeAudio(blob);
        if (!activeRef.current) return;
        if (!transcript.trim()) {
          runCycleRef.current();
          return;
        }
        setCaption(transcript);
        const reply = await replyFnRef.current(transcript);
        if (!activeRef.current) return;
        onExchangeRef.current?.(transcript, reply);

        setState("speaking");
        setCaption(reply);
        const speechBlob = await synthesizeSpeech(reply);
        if (!activeRef.current) return;
        const url = URL.createObjectURL(speechBlob);
        const audioEl = new Audio(url);
        audioElRef.current = audioEl;
        audioEl.onended = () => {
          URL.revokeObjectURL(url);
          window.setTimeout(() => activeRef.current && runCycleRef.current(), 250);
        };
        audioEl.onerror = () => {
          URL.revokeObjectURL(url);
          window.setTimeout(() => activeRef.current && runCycleRef.current(), 250);
        };
        await audioEl.play();
      } catch (err) {
        if (!activeRef.current) return;
        setState("error");
        setErrorText(err instanceof Error ? err.message : "Voice request failed.");
        activeRef.current = false;
      }
    };

    recorder.start();
    requestAnimationFrame(watchSilence);
  }, [teardownRecording]);

  useEffect(() => { runCycleRef.current = runRecordCycle; }, [runRecordCycle]);

  const start = useCallback(() => {
    activeRef.current = true;
    runRecordCycle();
  }, [runRecordCycle]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    teardownRecording();
    audioElRef.current?.pause();
    audioElRef.current = null;
    setState("idle");
  }, [teardownRecording]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      teardownRecording();
      audioElRef.current?.pause();
    };
  }, [teardownRecording]);

  return { state, caption, errorText, start, stop };
}
