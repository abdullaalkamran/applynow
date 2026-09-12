import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechRecognition, type SpeechRecognitionLike } from "./aiCounsellorEngine";

export type VoiceConversationState = "idle" | "listening" | "thinking" | "speaking" | "error";

function speak(text: string, onDone: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.onend = onDone;
  utterance.onerror = onDone;
  window.speechSynthesis.speak(utterance);
}

/**
 * Shared hands-free conversation loop — listens, replies, speaks, then listens again
 * automatically (like ChatGPT/Gemini voice) — until `stop()` is called. Used by both the sticky
 * AI Assistant icon and the full AI Counsellor page so the two can't drift out of sync.
 *
 * `replyFn` is passed in rather than imported directly so this hook stays role-agnostic — the
 * caller supplies whichever role's assistant (via `useAssistant().ask`) should handle the turn,
 * so voice-triggered actions go through the same per-role tool-calling loop as typed chat.
 */
export function useVoiceConversation(
  replyFn: (text: string) => Promise<string>,
  onExchange?: (userText: string, aiText: string) => void
) {
  const [state, setState] = useState<VoiceConversationState>("idle");
  const [caption, setCaption] = useState("");
  const [errorText, setErrorText] = useState("");
  const activeRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const replyFnRef = useRef(replyFn);
  const onExchangeRef = useRef(onExchange);
  const runListenCycleRef = useRef<() => void>(() => {});

  useEffect(() => {
    replyFnRef.current = replyFn;
  }, [replyFn]);

  useEffect(() => {
    onExchangeRef.current = onExchange;
  }, [onExchange]);

  const runListenCycle = useCallback(() => {
    if (!activeRef.current) return;
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setState("error");
      setErrorText("Voice isn't supported in this browser — try Chrome or Edge.");
      activeRef.current = false;
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = async (event) => {
      if (!activeRef.current) return;
      const transcript = event.results[0]?.[0]?.transcript;
      if (!transcript) return;
      setState("thinking");
      setCaption(transcript);
      const reply = await replyFnRef.current(transcript);
      if (!activeRef.current) return;
      onExchangeRef.current?.(transcript, reply);
      setState("speaking");
      setCaption(reply);
      speak(reply, () => {
        // Small pacing buffer so a browser that fires speechSynthesis's onend near-instantly
        // (no voices installed, empty text, etc.) can't spin the listen→reply loop unbounded.
        window.setTimeout(() => activeRef.current && runListenCycleRef.current(), 300);
      });
    };

    recognition.onerror = (event) => {
      if (!activeRef.current) return;
      if (event.error === "not-allowed") {
        setState("error");
        setErrorText("Microphone access was blocked — allow it in your browser settings to talk.");
        activeRef.current = false;
        return;
      }
      // Transient errors (no-speech, aborted, network hiccups) — just listen again.
      window.setTimeout(() => activeRef.current && runListenCycleRef.current(), 400);
    };

    recognitionRef.current = recognition;
    setState("listening");
    setCaption("Listening…");
    setErrorText("");
    recognition.start();
  }, []);

  useEffect(() => {
    runListenCycleRef.current = runListenCycle;
  }, [runListenCycle]);

  const start = useCallback(() => {
    activeRef.current = true;
    runListenCycle();
  }, [runListenCycle]);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setState("idle");
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return { state, caption, errorText, start, stop };
}
