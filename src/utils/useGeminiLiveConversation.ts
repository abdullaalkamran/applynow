import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_BASE } from "./backendBase";
import { useRole } from "../context/RoleContext";
import { ROLE_ASSISTANT_CONFIGS } from "./roleAssistantConfigs";
import type { VoiceConversationState } from "./useVoiceConversation";

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

function wsUrl(): string {
  const base = new URL(BACKEND_BASE);
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${base.host}/api/assistant/gemini-live`;
}

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === INPUT_SAMPLE_RATE) return input;
  const ratio = inputSampleRate / INPUT_SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    output[i] = input[Math.floor(i * ratio)];
  }
  return output;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function base64FromInt16(data: Int16Array): string {
  const bytes = new Uint8Array(data.buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function int16FromBase64(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/**
 * Realtime voice-to-voice via the Gemini Live relay (server/src/gemini/liveRelay.js). Unlike the
 * other two voice hooks, Gemini's own session does the "thinking" and tool-calling — this hook
 * just streams mic audio in, plays audio out, and executes whichever tool the relay asks for
 * locally (against real app data), sending the result back to keep the session going.
 */
export function useGeminiLiveConversation(onExchange?: (userText: string, aiText: string) => void) {
  const { role, currentUser } = useRole();
  const [state, setState] = useState<VoiceConversationState>("idle");
  const [caption, setCaption] = useState("");
  const [errorText, setErrorText] = useState("");

  const activeRef = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const onExchangeRef = useRef(onExchange);
  useEffect(() => { onExchangeRef.current = onExchange; }, [onExchange]);

  const stopAudioPipeline = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    captureCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;
    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;
    nextPlayTimeRef.current = 0;
  }, []);

  const playChunk = useCallback((base64: string) => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    const ctx = playbackCtxRef.current;
    const pcm16 = int16FromBase64(base64);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    socketRef.current?.send(JSON.stringify({ type: "stop" }));
    socketRef.current?.close();
    socketRef.current = null;
    stopAudioPipeline();
    setState("idle");
    setCaption("");
  }, [stopAudioPipeline]);

  const start = useCallback(async () => {
    activeRef.current = true;
    setState("listening");
    setCaption("Connecting…");
    setErrorText("");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
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

    const config = ROLE_ASSISTANT_CONFIGS[role];
    const ctx = { userId: currentUser.id, userName: currentUser.name };
    const tools = config.tools(ctx);
    const toolsByName = new Map(tools.map((tool) => [tool.spec.name, tool]));

    const socket = new WebSocket(wsUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "init", systemPrompt: config.systemPrompt(ctx), tools: tools.map((t) => t.spec) }));
    };

    socket.onmessage = async (event) => {
      if (!activeRef.current) return;
      let message: { type: string; [key: string]: unknown };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === "ready") {
        setCaption("Listening…");

        const captureCtx = new AudioContext();
        captureCtxRef.current = captureCtx;
        const source = captureCtx.createMediaStreamSource(stream);
        const processor = captureCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!activeRef.current || socket.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const downsampled = downsampleTo16k(input, captureCtx.sampleRate);
          const pcm16 = floatTo16BitPCM(downsampled);
          socket.send(JSON.stringify({ type: "audio", data: base64FromInt16(pcm16) }));
        };

        source.connect(processor);
        processor.connect(captureCtx.destination);
        return;
      }

      if (message.type === "audio" && typeof message.data === "string") {
        setState("speaking");
        playChunk(message.data);
        return;
      }

      if (message.type === "text" && typeof message.text === "string") {
        setCaption(message.text);
        onExchangeRef.current?.("(voice)", message.text);
        return;
      }

      if (message.type === "turn_complete") {
        setState("listening");
        return;
      }

      if (message.type === "tool_call" && typeof message.name === "string") {
        const tool = toolsByName.get(message.name);
        let result: unknown;
        try {
          result = tool ? await tool.execute((message.arguments as Record<string, unknown>) || {}) : { error: `Unknown tool "${message.name}"` };
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) };
        }
        socket.send(JSON.stringify({ type: "tool_result", id: message.id, name: message.name, result }));
        return;
      }

      if (message.type === "error" && typeof message.message === "string") {
        setState("error");
        setErrorText(message.message);
        activeRef.current = false;
        stopAudioPipeline();
      }
    };

    socket.onerror = () => {
      if (!activeRef.current) return;
      setState("error");
      setErrorText("Gemini Live connection failed.");
      activeRef.current = false;
      stopAudioPipeline();
    };

    socket.onclose = () => {
      if (activeRef.current) {
        activeRef.current = false;
        stopAudioPipeline();
        setState("idle");
      }
    };
  }, [role, currentUser, playChunk, stopAudioPipeline]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      socketRef.current?.close();
      stopAudioPipeline();
    };
  }, [stopAudioPipeline]);

  return { state, caption, errorText, start, stop };
}
