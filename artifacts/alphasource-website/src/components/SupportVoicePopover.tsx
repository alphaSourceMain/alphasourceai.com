import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, HelpCircle, LoaderCircle, Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  SUPPORT_VOICE_CHUNK_SAMPLES,
  SUPPORT_VOICE_SAMPLE_RATE,
  pcm16ToStandardBase64,
  resampleToPcm16,
  standardBase64ToPcm16,
} from "@/lib/supportVoiceAudio";
import {
  nextSupportVoiceState,
  parseSupportVoiceServerMessage,
  type VoiceState,
} from "@/lib/supportVoiceServerMessages";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const env = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}) as Record<string, unknown>;
const QA_API_ORIGIN = "https://ia-backend-qa.onrender.com";
const FEATURE_ENABLED = String(env.VITE_SUPPORT_VOICE_ENABLED || "").trim() === "true";

function resolveBackendOrigin(): string | null {
  const raw = String(env.VITE_BACKEND_URL || "").trim();
  try {
    const url = new URL(raw);
    if (raw !== QA_API_ORIGIN || url.origin !== raw || url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return raw;
  } catch {
    return null;
  }
}

function statusText(state: VoiceState): string {
  if (state === "requesting") return "Waiting for microphone permission…";
  if (state === "connecting") return "Connecting securely…";
  if (state === "listening") return "Listening";
  if (state === "speaking") return "Support is speaking";
  if (state === "muted") return "Muted — this conversation will end after two minutes without voice activity.";
  if (state === "ended") return "Conversation ended.";
  if (state === "conflict") return "A support conversation or pending request is already open for this account.";
  if (state === "error") return "Support is unavailable right now. Please use the Help Center.";
  return "Ready when you are.";
}

export default function SupportVoicePopover() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [serviceWorkerSafe, setServiceWorkerSafe] = useState(false);
  const [serviceWorkerChecked, setServiceWorkerChecked] = useState(false);
  const websocketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pcmQueueRef = useRef<number[]>([]);
  const canSendRef = useRef(false);
  const mutedRef = useRef(false);
  const scheduledRef = useRef(new Set<AudioBufferSourceNode>());
  const playbackEpochRef = useRef(0);
  const nextPlaybackTimeRef = useRef(0);
  const queuedPlaybackBytesRef = useRef(0);
  const responseActiveRef = useRef(false);
  const abandonNeededRef = useRef(false);
  const lifecycleEpochRef = useRef(0);
  const mountedRef = useRef(true);
  const backendOrigin = resolveBackendOrigin();
  const available = FEATURE_ENABLED && Boolean(backendOrigin) && serviceWorkerChecked && serviceWorkerSafe && typeof window !== "undefined" && Boolean(window.AudioContext) && Boolean(navigator.mediaDevices?.getUserMedia);

  const stopPlayback = useCallback(() => {
    playbackEpochRef.current += 1;
    for (const source of scheduledRef.current) {
      try { source.stop(); } catch {}
      try { source.buffer?.getChannelData(0).fill(0); } catch {}
    }
    scheduledRef.current.clear();
    queuedPlaybackBytesRef.current = 0;
    nextPlaybackTimeRef.current = 0;
    responseActiveRef.current = false;
  }, []);

  const releaseMedia = useCallback(() => {
    canSendRef.current = false;
    pcmQueueRef.current.fill(0);
    pcmQueueRef.current = [];
    stopPlayback();
    try { processorRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    processorRef.current = null;
    sourceRef.current = null;
    for (const track of streamRef.current?.getTracks() || []) track.stop();
    streamRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }, [stopPlayback]);

  const abandonPending = useCallback(async () => {
    if (!backendOrigin || !abandonNeededRef.current) return;
    abandonNeededRef.current = false;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${backendOrigin}/api/support/voice/sessions/pending`, {
      method: "DELETE",
      body: undefined,
      cache: "no-store",
      credentials: "omit",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [backendOrigin]);

  const endConversation = useCallback((next: VoiceState = "ended") => {
    lifecycleEpochRef.current += 1;
    const socket = websocketRef.current;
    websocketRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      try { socket.close(1000, "ended"); } catch {}
    }
    releaseMedia();
    if (mountedRef.current) setState(next);
    void abandonPending();
  }, [abandonPending, releaseMedia]);

  const scheduleAudio = useCallback((encoded: unknown) => {
    const context = contextRef.current;
    const samples = standardBase64ToPcm16(encoded);
    if (!context || !samples || samples.byteLength === 0) return endConversation("error");
    if (!responseActiveRef.current) { samples.fill(0); return; }
    if (scheduledRef.current.size >= 12 || queuedPlaybackBytesRef.current + samples.byteLength > 512 * 1024) {
      samples.fill(0);
      return endConversation("error");
    }
    const epoch = playbackEpochRef.current;
    const buffer = context.createBuffer(1, samples.length, SUPPORT_VOICE_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 0x8000;
    samples.fill(0);
    if (epoch !== playbackEpochRef.current) {
      channel.fill(0);
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startsAt = Math.max(context.currentTime + 0.015, nextPlaybackTimeRef.current);
    nextPlaybackTimeRef.current = startsAt + buffer.duration;
    queuedPlaybackBytesRef.current += buffer.length * 2;
    scheduledRef.current.add(source);
    source.onended = () => {
      scheduledRef.current.delete(source);
      queuedPlaybackBytesRef.current = Math.max(0, queuedPlaybackBytesRef.current - buffer.length * 2);
      channel.fill(0);
      try { source.disconnect(); } catch {}
    };
    source.start(startsAt);
  }, [endConversation]);

  const startCapture = useCallback((context: AudioContext, stream: MediaStream, socket: WebSocket) => {
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (!canSendRef.current || mutedRef.current || socket.readyState !== WebSocket.OPEN) return;
      const pcm = resampleToPcm16(event.inputBuffer.getChannelData(0), context.sampleRate);
      for (const sample of pcm) pcmQueueRef.current.push(sample);
      pcm.fill(0);
      while (pcmQueueRef.current.length >= SUPPORT_VOICE_CHUNK_SAMPLES) {
        const chunk = new Int16Array(pcmQueueRef.current.splice(0, SUPPORT_VOICE_CHUNK_SAMPLES));
        const frame = JSON.stringify({ type: "input_audio_buffer.append", audio: pcm16ToStandardBase64(chunk) });
        chunk.fill(0);
        if (socket.bufferedAmount > 256 * 1024 || new TextEncoder().encode(frame).byteLength > 48 * 1024) return endConversation("error");
        socket.send(frame);
      }
    };
    source.connect(processor);
    processor.connect(context.destination);
    sourceRef.current = source;
    processorRef.current = processor;
  }, [endConversation]);

  const startConversation = useCallback(() => {
    if (!available || !backendOrigin || state === "requesting" || state === "connecting" || state === "listening" || state === "speaking" || state === "muted") return;
    const context = new AudioContext({ sampleRate: SUPPORT_VOICE_SAMPLE_RATE });
    const lifecycleEpoch = lifecycleEpochRef.current + 1;
    lifecycleEpochRef.current = lifecycleEpoch;
    contextRef.current = context;
    void context.resume();
    setState("requesting");
    const mediaPromise = navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });

    void (async () => {
      try {
        const stream = await mediaPromise;
        if (lifecycleEpoch !== lifecycleEpochRef.current) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const { data, error } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (error || !token) throw new Error("auth");
        if (lifecycleEpoch !== lifecycleEpochRef.current) return releaseMedia();
        setState("connecting");
        let response: Response;
        try {
          response = await fetch(`${backendOrigin}/api/support/voice/sessions`, {
            method: "POST",
            body: undefined,
            cache: "no-store",
            credentials: "omit",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          abandonNeededRef.current = true;
          throw new Error("create_network");
        }
        if (lifecycleEpoch !== lifecycleEpochRef.current) {
          abandonNeededRef.current = response.status === 201;
          return endConversation("ended");
        }
        if (response.status === 409) {
          releaseMedia();
          return setState("conflict");
        }
        if (response.status === 201) abandonNeededRef.current = true;
        const body = await response.json().catch(() => null) as { session_id?: unknown; credential?: unknown; expires_at?: unknown } | null;
        if (!response.ok || !body || typeof body.session_id !== "string" || typeof body.credential !== "string" || typeof body.expires_at !== "string" || Object.keys(body).sort().join(",") !== "credential,expires_at,session_id") throw new Error("create");
        abandonNeededRef.current = true;
        let credential = body.credential;
        body.credential = "";
        body.session_id = "";
        const wsUrl = `${backendOrigin.replace(/^https:/, "wss:")}/api/support/voice`;
        const socket = new WebSocket(wsUrl, "alphascreen-support-v1");
        websocketRef.current = socket;
        socket.addEventListener("open", () => {
          if (lifecycleEpoch !== lifecycleEpochRef.current) {
            credential = "";
            return endConversation("ended");
          }
          try {
            socket.send(JSON.stringify({ type: "authenticate", credential }));
          } finally {
            credential = "";
          }
          abandonNeededRef.current = false;
          startCapture(context, stream, socket);
        }, { once: true });
        socket.addEventListener("message", (event) => {
          if (typeof event.data !== "string") return endConversation("error");
          let decoded: unknown;
          try { decoded = JSON.parse(event.data); } catch { return endConversation("error"); }
          const message = parseSupportVoiceServerMessage(decoded);
          if (!message) return endConversation("error");
          if (message.type === "ready") {
            canSendRef.current = true;
            mutedRef.current = false;
            return setState((current) => nextSupportVoiceState(current, message, mutedRef.current));
          }
          if (message.type === "listening") {
            if (message.active) {
              responseActiveRef.current = false;
              stopPlayback();
            }
            return setState((current) => nextSupportVoiceState(current, message, mutedRef.current));
          }
          if (message.type === "speaking") {
            responseActiveRef.current = message.active;
            return setState((current) => nextSupportVoiceState(current, message, mutedRef.current));
          }
          if (message.type === "audio_delta") return scheduleAudio(message.audio);
          if (message.type === "ended") return endConversation("ended");
          if (message.type === "error") return endConversation("error");
        });
        socket.addEventListener("close", () => {
          credential = "";
          if (websocketRef.current === socket) websocketRef.current = null;
          releaseMedia();
          if (mountedRef.current) setState((current) => current === "error" ? "error" : "ended");
        });
        socket.addEventListener("error", () => {
          credential = "";
          endConversation("error");
        }, { once: true });
      } catch {
        endConversation("error");
      }
    })();
  }, [available, backendOrigin, endConversation, releaseMedia, scheduleAudio, startCapture, state, stopPlayback]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setState(mutedRef.current ? "muted" : "listening");
  }, []);

  const resetPending = useCallback(() => {
    abandonNeededRef.current = true;
    void abandonPending().finally(() => {
      if (mountedRef.current) setState("idle");
    });
  }, [abandonPending]);

  useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      try {
        if (!("serviceWorker" in navigator)) {
          setServiceWorkerSafe(true);
        } else {
          const registrations = await navigator.serviceWorker.getRegistrations();
          const controlled = Boolean(navigator.serviceWorker.controller);
          const scoped = registrations.some((registration) => Boolean(registration.active || registration.waiting || registration.installing) && window.location.href.startsWith(registration.scope));
          setServiceWorkerSafe(!controlled && !scoped);
        }
      } catch {
        setServiceWorkerSafe(false);
      } finally {
        setServiceWorkerChecked(true);
      }
    })();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") endConversation("ended");
    });
    return () => {
      mountedRef.current = false;
      data.subscription.unsubscribe();
      endConversation("ended");
    };
  }, [endConversation]);

  if (!FEATURE_ENABLED) return null;

  const active = ["requesting", "connecting", "listening", "speaking", "muted"].includes(state);
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next && active) endConversation("ended"); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Talk with Support"
          className="mr-2 inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold transition-colors hover:border-[#A380F6]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]/45 sm:px-3"
          style={{ backgroundColor: "var(--as-accent-soft)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
        >
          <Headphones className="h-4 w-4" aria-hidden="true" />
          <span>Talk with Support</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} aria-label="Browser AI support" className="w-[calc(100vw-2rem)] max-w-sm rounded-lg border p-4 shadow-lg" style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text)" }}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "var(--as-accent-soft-strong)", color: "#A380F6" }}>
            {state === "speaking" ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <Headphones className="h-4 w-4" aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black">alphaSource Support</p>
            <p className="mt-1 text-xs leading-relaxed" aria-live="polite" style={{ color: "var(--as-text)", opacity: 0.68 }}>{statusText(!serviceWorkerChecked ? "connecting" : available ? state : "error")}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg border p-3 text-xs leading-relaxed" style={{ borderColor: "var(--as-border)", color: "var(--as-text)", opacity: 0.72, backgroundColor: "var(--as-surface-muted)" }}>
          Your voice is processed by our AI support provider. alphaScreen does not store recordings or transcripts in this phase. Do not share candidate information, payment details, passwords, one-time codes, or other sensitive information.
        </p>
        {!active && state !== "conflict" && (
          <button type="button" disabled={!available} onClick={startConversation} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#7252C7] px-4 text-sm font-black text-white transition-colors hover:bg-[#6242B5] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7252C7]/50 focus-visible:ring-offset-2">
            {state === "requesting" || state === "connecting" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            Start support conversation
          </button>
        )}
        {state === "conflict" && (
          <button type="button" onClick={resetPending} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border px-4 text-sm font-black" style={{ borderColor: "var(--as-border)" }}>
            Reset pending request
          </button>
        )}
        {active && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={state === "requesting" || state === "connecting"} onClick={toggleMute} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 text-xs font-black disabled:opacity-50" style={{ borderColor: "var(--as-border)" }}>
              {state === "muted" ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {state === "muted" ? "Unmute" : "Mute"}
            </button>
            <button type="button" onClick={() => endConversation("ended")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 px-3 text-xs font-black text-red-600">
              <PhoneOff className="h-4 w-4" /> End
            </button>
          </div>
        )}
        <a href="/dashboard/support" className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs font-bold text-[#7252C7] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7252C7]/45 dark:text-[#C7B5FF]">
          <HelpCircle className="h-3.5 w-3.5" /> View Help Center
        </a>
      </PopoverContent>
    </Popover>
  );
}
