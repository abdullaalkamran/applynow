import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechRecognition, type SpeechRecognitionLike } from "./aiCounsellorEngine";

/** Continuous voice-to-text — every browser-finalized chunk of speech is handed to `onChunk` as
 * it's recognized, so a caller can append it to a draft textarea live. Uses the browser's own
 * (free, local) Web Speech API, the same one useVoiceConversation.ts's single-shot listening uses
 * — no server round trip, no AI provider quota spent, since this is plain speech-to-text, not
 * anything that needs a model. `continuous: true` browsers occasionally end a recognition session
 * on a pause in speech even though the caller never asked to stop — restarted automatically here
 * as long as `stop()` hasn't actually been called, so recording feels like one continuous session
 * to the caller. */
export function useSpeechToText(onChunk: (chunk: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const onChunkRef = useRef(onChunk);

  useEffect(() => {
    onChunkRef.current = onChunk;
  }, [onChunk]);

  const supported = typeof window !== "undefined" && !!getSpeechRecognition();

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser — try Chrome or Edge, or type your answer instead.");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
      }
      if (finalChunk.trim()) onChunkRef.current(finalChunk.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone access was blocked — allow it in your browser settings to record your answer.");
        activeRef.current = false;
        setIsRecording(false);
        return;
      }
      // Transient errors (no-speech, network hiccups) — onend below restarts if still active.
    };

    recognition.onend = () => {
      if (activeRef.current) recognition.start();
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    setError(null);
    setIsRecording(true);
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { isRecording, supported, error, start, stop };
}
