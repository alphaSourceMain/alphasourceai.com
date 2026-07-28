import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { alphaSourceLogo } from "@/assets/branding";

type LiveSessionState = {
  conversation_url: string;
  conversation_id: string;
  interview_id: string;
  role_token: string;
  max_interview_minutes: number | null;
  email?: string;
  candidate_id?: string;
  role_id?: string;
  candidate_assistance_contact?: string;
  selectedCameraDeviceId?: string;
  selectedMicrophoneDeviceId?: string;
};

type DailyTrackSlot = {
  state?: string;
  track?: MediaStreamTrack | null;
  persistentTrack?: MediaStreamTrack | null;
};

type DailyParticipant = {
  local?: boolean;
  session_id?: string;
  tracks?: {
    video?: DailyTrackSlot;
    audio?: DailyTrackSlot;
  };
};

type RemoteParticipantEvidence = {
  remotePresent: boolean;
  remoteAudioReady: boolean;
  remoteVideoReady: boolean;
  remoteParticipantCount: number;
};

type ReliabilityMetadata = Record<string, string | number | boolean>;

export type ReliabilityDiagnosticEvent = {
  event: string;
  metadata: ReliabilityMetadata;
};

type RemoteDiagnosticContext = {
  recoveryActive: boolean;
  recoveryAttempt: 0 | 1;
  recoveryPhase: ReconnectRecoveryPhase;
};

export type ReconnectRecoveryPhase =
  | "idle"
  | "reconnecting_transport"
  | "awaiting_remote_presence"
  | "awaiting_remote_media"
  | "awaiting_practical_progress"
  | "recovered"
  | "failed";

export type ReconnectProgressSource = "replica_started_speaking" | "replica_utterance";

export type ReconnectRecoveryState = {
  phase: ReconnectRecoveryPhase;
  attempt: 0 | 1;
  startedAt: number | null;
  localJoinedAt: number | null;
  remotePresent: boolean;
  remoteAudioReady: boolean;
  remoteVideoReady: boolean;
  progressAt: number | null;
  progressSource: ReconnectProgressSource | null;
  terminalAt: number | null;
};

export type ReconnectRecoveryEvent =
  | { type: "start"; at: number }
  | { type: "local_joined"; at: number }
  | ({ type: "remote_state"; at: number } & RemoteParticipantEvidence)
  | { type: "practical_progress"; at: number; source: ReconnectProgressSource }
  | { type: "deadline"; at: number }
  | { type: "join_failed"; at: number };

type DailyEvent = {
  action?: string;
  error?: unknown;
  errorMsg?: string;
  data?: any;
  participant?: DailyParticipant;
  participants?: Record<string, DailyParticipant>;
  meetingState?: string;
};

type DailyCallObject = {
  join: (options: { url: string; userName?: string; startAudioOff?: boolean; startVideoOff?: boolean }) => Promise<unknown>;
  leave: () => Promise<unknown>;
  destroy: () => void;
  on: (event: string, handler: (event?: DailyEvent) => void) => void;
  off?: (event: string, handler: (event?: DailyEvent) => void) => void;
  participants?: () => Record<string, DailyParticipant>;
  sendAppMessage?: (message: unknown, recipients?: string | string[]) => void;
  startRecording?: () => Promise<unknown>;
  setInputDevicesAsync?: (devices: { videoDeviceId?: string; audioDeviceId?: string }) => Promise<unknown>;
  setInputDevices?: (devices: { videoDeviceId?: string; audioDeviceId?: string }) => Promise<unknown> | unknown;
};

type DailySdk = {
  createCallObject: () => DailyCallObject;
};

declare global {
  interface Window {
    DailyIframe?: DailySdk;
  }
}

const DAILY_SCRIPT_ID = "alphasource-daily-sdk";
const DAILY_SCRIPT_SRC = "https://unpkg.com/@daily-co/daily-js";
const LIVE_STATE_KEY = "alphasource_interview_live_state";
const STARTUP_REMOTE_TIMEOUT_MS = 12000;
// The Tavus prompt checks silence after 4-5 seconds; 45 seconds with no utterance is well beyond normal prompt progression.
const PROGRESS_STALL_MS = 45000;
const PROGRESS_WATCHDOG_INTERVAL_MS = 5000;
const RECOVERY_PROGRESS_TIMEOUT_MS = 30000;
const IDLE_ENGAGEMENT_GRACE_MS = 30000;
const TIME_WARNING_THRESHOLD_SECONDS = 120;
const GRACEFUL_WRAP_THRESHOLD_SECONDS = 60;
const FORCE_END_THRESHOLD_SECONDS = 15;
const GRACEFUL_FORCE_END_DELAY_MS = 15000;
const TIME_WARNING_NOTICE = "About 2 minutes remaining. The interviewer will begin wrapping up.";
const GRACEFUL_WRAP_NOTICE = "Less than 1 minute remaining. The interview is wrapping up.";
const TIME_WARNING_TEXT = "Time warning: about 2 minutes remain. Stop asking new substantive questions soon and begin wrapping up naturally.";
const GRACEFUL_WRAP_TEXT = "Time limit wrap-up: stop asking new substantive questions now. Use the final closing line and end the interview.";
const CLOSING_UTTERANCE_END_DELAY_MS = 5500;
const MAX_PENDING_TELEMETRY_REQUESTS = 8;

const env = (
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {}
) as Record<string, string | undefined>;

function trimTrailingSlashes(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value || "");
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  env.VITE_BACKEND_URL,
  env.VITE_API_URL,
  env.VITE_PUBLIC_BACKEND_URL,
  env.PUBLIC_BACKEND_URL,
  env.BACKEND_URL,
);

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return `${base.slice(0, -1)}${path}`;
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function readLiveState(): LiveSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LIVE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveSessionState>;
    const conversationUrl = String(parsed?.conversation_url || "").trim();
    if (!conversationUrl) return null;
    const maxRaw = Number(parsed?.max_interview_minutes);
    return {
      conversation_url: conversationUrl,
      conversation_id: String(parsed?.conversation_id || "").trim(),
      interview_id: String(parsed?.interview_id || "").trim(),
      role_token: String(parsed?.role_token || "").trim(),
      max_interview_minutes: Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : null,
      email: parsed?.email ? String(parsed.email) : undefined,
      candidate_id: parsed?.candidate_id ? String(parsed.candidate_id) : undefined,
      role_id: parsed?.role_id ? String(parsed.role_id) : undefined,
      candidate_assistance_contact: parsed?.candidate_assistance_contact ? String(parsed.candidate_assistance_contact) : undefined,
      selectedCameraDeviceId: parsed?.selectedCameraDeviceId ? String(parsed.selectedCameraDeviceId) : undefined,
      selectedMicrophoneDeviceId: parsed?.selectedMicrophoneDeviceId ? String(parsed.selectedMicrophoneDeviceId) : undefined,
    };
  } catch {
    return null;
  }
}

function loadDailySdk(): Promise<DailySdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Daily SDK can only run in the browser."));
  }
  if (window.DailyIframe?.createCallObject) return Promise.resolve(window.DailyIframe);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(DAILY_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const onLoad = () => {
        if (window.DailyIframe?.createCallObject) resolve(window.DailyIframe);
        else reject(new Error("Daily SDK failed to initialize."));
      };
      const onError = () => reject(new Error("Failed to load Daily SDK."));
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = DAILY_SCRIPT_ID;
    script.src = DAILY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.DailyIframe?.createCallObject) resolve(window.DailyIframe);
      else reject(new Error("Daily SDK failed to initialize."));
    };
    script.onerror = () => reject(new Error("Failed to load Daily SDK."));
    document.head.appendChild(script);
  });
}

function extractTrack(slot?: DailyTrackSlot): MediaStreamTrack | null {
  if (!slot) return null;
  const state = String(slot.state || "").toLowerCase();
  if (state && state !== "playable" && state !== "sendable" && state !== "loading") return null;
  return slot.persistentTrack || slot.track || null;
}

function isRemoteTrackReady(slot?: DailyTrackSlot): boolean {
  if (!slot) return false;
  const state = String(slot.state || "").toLowerCase();
  const track = slot.persistentTrack || slot.track || null;
  return Boolean(track && track.readyState !== "ended" && state === "playable");
}

export function createReconnectRecoveryState(): ReconnectRecoveryState {
  return {
    phase: "idle",
    attempt: 0,
    startedAt: null,
    localJoinedAt: null,
    remotePresent: false,
    remoteAudioReady: false,
    remoteVideoReady: false,
    progressAt: null,
    progressSource: null,
    terminalAt: null,
  };
}

export function isReconnectRecoveryActive(state: ReconnectRecoveryState): boolean {
  return (
    state.phase === "reconnecting_transport" ||
    state.phase === "awaiting_remote_presence" ||
    state.phase === "awaiting_remote_media" ||
    state.phase === "awaiting_practical_progress"
  );
}

export function reconnectRecoveryNotice(state: ReconnectRecoveryState): string {
  if (state.phase === "reconnecting_transport") return "Reconnecting to the interview…";
  if (
    state.phase === "awaiting_remote_presence" ||
    state.phase === "awaiting_remote_media" ||
    state.phase === "awaiting_practical_progress"
  ) {
    return "Reconnected. Waiting for the interviewer to resume…";
  }
  if (state.phase === "recovered") return "Connection restored.";
  return "";
}

function isReconnectProgressSource(value: unknown): value is ReconnectProgressSource {
  return value === "replica_started_speaking" || value === "replica_utterance";
}

export function advanceReconnectRecovery(
  state: ReconnectRecoveryState,
  event: ReconnectRecoveryEvent,
): ReconnectRecoveryState {
  if (state.phase === "recovered" || state.phase === "failed") return state;

  if (event.type === "start") {
    if (state.phase !== "idle" || state.attempt !== 0) return state;
    return {
      ...createReconnectRecoveryState(),
      phase: "reconnecting_transport",
      attempt: 1,
      startedAt: event.at,
    };
  }

  if (state.phase === "idle") return state;

  if (event.type === "join_failed" || event.type === "deadline") {
    return {
      ...state,
      phase: "failed",
      terminalAt: event.at,
    };
  }

  if (event.type === "local_joined") {
    if (state.phase !== "reconnecting_transport") return state;
    return {
      ...state,
      phase: "awaiting_remote_presence",
      localJoinedAt: event.at,
    };
  }

  if (event.type === "remote_state") {
    if (state.localJoinedAt === null) return state;
    const remotePresent = Boolean(event.remotePresent);
    const remoteAudioReady = remotePresent && Boolean(event.remoteAudioReady);
    const remoteVideoReady = remotePresent && Boolean(event.remoteVideoReady);
    return {
      ...state,
      phase: !remotePresent
        ? "awaiting_remote_presence"
        : !remoteAudioReady
          ? "awaiting_remote_media"
          : "awaiting_practical_progress",
      remotePresent,
      remoteAudioReady,
      remoteVideoReady,
    };
  }

  if (
    event.type === "practical_progress" &&
    isReconnectProgressSource(event.source) &&
    state.phase === "awaiting_practical_progress" &&
    state.remotePresent &&
    state.remoteAudioReady
  ) {
    return {
      ...state,
      phase: "recovered",
      progressAt: event.at,
      progressSource: event.source,
      terminalAt: event.at,
    };
  }

  return state;
}

function remoteMediaState(ready: boolean, present: boolean): "playable" | "unavailable" | "absent" {
  if (!present) return "absent";
  return ready ? "playable" : "unavailable";
}

export function deriveRemoteDiagnosticEvents(
  previous: RemoteParticipantEvidence | null,
  current: RemoteParticipantEvidence,
  context: RemoteDiagnosticContext,
): ReliabilityDiagnosticEvent[] {
  const prior = previous || {
    remotePresent: false,
    remoteAudioReady: false,
    remoteVideoReady: false,
    remoteParticipantCount: 0,
  };
  const events: ReliabilityDiagnosticEvent[] = [];
  const recoveryMetadata: ReliabilityMetadata = context.recoveryActive
    ? {
        recovery_attempt: context.recoveryAttempt,
        recovery_phase: context.recoveryPhase,
        is_recovery_active: true,
      }
    : {};
  const participantMetadata = {
    participant_role: "replica",
    participant_count: current.remoteParticipantCount,
    remote_participant_present: current.remotePresent,
    ...recoveryMetadata,
  };

  if (!prior.remotePresent && current.remotePresent) {
    events.push({ event: "daily_participant_joined", metadata: participantMetadata });
    if (context.recoveryActive) {
      events.push({ event: "reconnect_remote_presence", metadata: participantMetadata });
    }
  } else if (prior.remotePresent && !current.remotePresent) {
    events.push({
      event: "daily_participant_left",
      metadata: participantMetadata,
    });
  }

  for (const [kind, previousReady, currentReady] of [
    ["audio", prior.remoteAudioReady, current.remoteAudioReady],
    ["video", prior.remoteVideoReady, current.remoteVideoReady],
  ] as const) {
    if (!previousReady && currentReady) {
      events.push({
        event: "daily_remote_track_started",
        metadata: {
          track_kind: kind,
          track_state: "playable",
          ...participantMetadata,
        },
      });
      if (kind === "audio" && context.recoveryActive) {
        events.push({
          event: "reconnect_remote_audio_ready",
          metadata: {
            remote_audio_state: "playable",
            ...participantMetadata,
          },
        });
      }
    } else if (previousReady && !currentReady) {
      events.push({
        event: "daily_remote_track_stopped",
        metadata: {
          track_kind: kind,
          track_state: "unavailable",
          ...participantMetadata,
        },
      });
    }
  }

  if (
    context.recoveryActive &&
    (
      prior.remotePresent !== current.remotePresent ||
      prior.remoteAudioReady !== current.remoteAudioReady ||
      prior.remoteVideoReady !== current.remoteVideoReady
    )
  ) {
    events.push({
      event: "reconnect_remote_media_changed",
      metadata: {
        remote_audio_state: remoteMediaState(current.remoteAudioReady, current.remotePresent),
        remote_video_state: remoteMediaState(current.remoteVideoReady, current.remotePresent),
        ...participantMetadata,
      },
    });
  }

  return events;
}

function setElementTrack(element: HTMLMediaElement | null, track: MediaStreamTrack | null): void {
  if (!element) return;
  if (!track) {
    if (element.srcObject) element.srcObject = null;
    return;
  }

  const current = element.srcObject instanceof MediaStream ? element.srcObject : null;
  const currentTrack = current?.getTracks?.()[0] || null;
  if (currentTrack !== track) {
    element.srcObject = new MediaStream([track]);
  }
  void element.play().catch(() => {});
}

function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function isCandidateAnswerProgress(text: string): boolean {
  const normalized = String(text || "").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 5 || /\?\s*$/.test(normalized)) return false;
  return /\b(i|my|we|because|example|python|javascript|typescript|sql|project|team|built|led|managed|implemented|designed)\b/i.test(normalized);
}

export default function InterviewCviPage() {
  const [, setLocation] = useLocation();
  const [session] = useState<LiveSessionState | null>(() => readLiveState());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finishBusy, setFinishBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [timeNotice, setTimeNotice] = useState("");
  const [connectionNotice, setConnectionNotice] = useState("");
  const [progressStalled, setProgressStalled] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);

  const callRef = useRef<DailyCallObject | null>(null);
  const leavingRef = useRef(false);
  const reconnectingRef = useRef(false);
  const endTriggeredRef = useRef(false);
  const timeWarningSentRef = useRef(false);
  const gracefulWrapSentRef = useRef(false);
  const gracefulForceEndTimerRef = useRef<number | null>(null);
  const closeEndTimerRef = useRef<number | null>(null);
  const startupRemoteSeenRef = useRef(false);
  const startupRecoveryAttemptedRef = useRef(false);
  const startupTimerRef = useRef<number | null>(null);
  const startMsRef = useRef<number>(Date.now());
  const recordingStartRequestedRef = useRef(false);
  const progressObservedRef = useRef(false);
  const lastProgressAtRef = useRef<number | null>(null);
  const progressRecoveryAttemptedRef = useRef(false);
  const progressRecoveryInFlightRef = useRef(false);
  const progressRecoveryStateRef = useRef<ReconnectRecoveryState>(createReconnectRecoveryState());
  const lastAiSpeechAtRef = useRef<number | null>(null);
  const lastAiSpeechStoppedAtRef = useRef<number | null>(null);
  const telemetrySequenceRef = useRef(0);
  const telemetryPendingRef = useRef<Set<Promise<unknown>>>(new Set());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const clearStartupTimer = useCallback(() => {
    if (startupTimerRef.current) {
      window.clearTimeout(startupTimerRef.current);
      startupTimerRef.current = null;
    }
  }, []);

  const clearAutoEndTimers = useCallback(() => {
    if (gracefulForceEndTimerRef.current) {
      window.clearTimeout(gracefulForceEndTimerRef.current);
      gracefulForceEndTimerRef.current = null;
    }
    if (closeEndTimerRef.current) {
      window.clearTimeout(closeEndTimerRef.current);
      closeEndTimerRef.current = null;
    }
  }, []);

  const syncParticipants = useCallback((participants?: Record<string, DailyParticipant>): RemoteParticipantEvidence => {
    const map = participants || callRef.current?.participants?.() || {};
    const list = Object.values(map);
    const local = list.find((p) => Boolean(p?.local));
    const remotes = list.filter((p) => !p?.local);

    const localVideoTrack = extractTrack(local?.tracks?.video);
    const remoteVideoTrack = remotes.map((remote) => extractTrack(remote?.tracks?.video)).find(Boolean) || null;
    const remoteAudioTrack = remotes.map((remote) => extractTrack(remote?.tracks?.audio)).find(Boolean) || null;

    setElementTrack(localVideoRef.current, localVideoTrack);
    setElementTrack(remoteVideoRef.current, remoteVideoTrack);
    setElementTrack(remoteAudioRef.current, remoteAudioTrack);

    const hasRemote = Boolean(remoteVideoTrack);
    setHasRemoteVideo(hasRemote);
    setHasLocalVideo(Boolean(localVideoTrack));
    if (hasRemote) {
      startupRemoteSeenRef.current = true;
      clearStartupTimer();
      setLoading(false);
      setError("");
    }
    return {
      remotePresent: remotes.length > 0,
      remoteAudioReady: remotes.some((remote) => isRemoteTrackReady(remote?.tracks?.audio)),
      remoteVideoReady: remotes.some((remote) => isRemoteTrackReady(remote?.tracks?.video)),
      remoteParticipantCount: Math.min(16, remotes.length),
    };
  }, [clearStartupTimer]);

  const teardownCall = useCallback(async () => {
    clearStartupTimer();
    const call = callRef.current;
    callRef.current = null;
    if (!call) return;

    try {
      await call.leave().catch(() => {});
    } catch {}
    try {
      call.destroy();
    } catch {}

    setElementTrack(localVideoRef.current, null);
    setElementTrack(remoteVideoRef.current, null);
    setElementTrack(remoteAudioRef.current, null);
  }, [clearStartupTimer]);

  const leaveLiveRoute = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    await teardownCall();
    try {
      window.sessionStorage.removeItem(LIVE_STATE_KEY);
    } catch {}
    setLocation("/interview/complete");
  }, [setLocation, teardownCall]);

  const endInterview = useCallback(async (reason: string, stayOnPage = false) => {
    if (endTriggeredRef.current) {
      setFinishBusy(false);
      return;
    }
    endTriggeredRef.current = true;
    if (stayOnPage) leavingRef.current = true;
    clearAutoEndTimers();
    try {
      const conversationId = String(session?.conversation_id || "").trim();
      const interviewId = String(session?.interview_id || "").trim();
      const roleToken = String(session?.role_token || "").trim();
      if (backendBase && conversationId && interviewId && roleToken) {
        const response = await fetch(joinUrl(backendBase, "/tavus/end-conversation"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            interview_id: interviewId,
            role_token: roleToken,
            reason,
          }),
        });
        if (!response.ok) {
          console.warn("[InterviewCviPage] End interview request failed.", { reason, status: response.status });
        }
      }
    } catch (error) {
      console.warn("[InterviewCviPage] Could not end interview cleanly. Closing this session now.", { reason, error });
      if (!stayOnPage) setError("Could not end interview cleanly. Closing this session now.");
    } finally {
      setFinishBusy(false);
      if (stayOnPage) await teardownCall();
      else await leaveLiveRoute();
    }
  }, [clearAutoEndTimers, leaveLiveRoute, session, teardownCall]);

  const sendLifecycleTelemetry = useCallback((
    event: string,
    metadata: ReliabilityMetadata = {},
    options: { reason?: string; terminal?: boolean } = {},
  ) => {
    const eventSequence = telemetrySequenceRef.current + 1;
    const conversationId = String(session?.conversation_id || "").trim();
    const roleToken = String(session?.role_token || "").trim();
    const payload = {
      interview_id: String(session?.interview_id || "").trim(),
      event,
      event_sequence: eventSequence,
      observed_at: new Date().toISOString(),
      reason: options.reason,
      metadata,
    };
    if (!backendBase || !payload.interview_id || !conversationId || !roleToken) return;
    telemetrySequenceRef.current = eventSequence;
    const url = joinUrl(backendBase, "/tavus/client-telemetry");
    try {
      const pendingLimit = options.terminal
        ? MAX_PENDING_TELEMETRY_REQUESTS
        : MAX_PENDING_TELEMETRY_REQUESTS - 1;
      if (telemetryPendingRef.current.size >= pendingLimit) return;
      const authorization = btoa(JSON.stringify([roleToken, conversationId]));
      const request = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `AlphaScreen-Telemetry ${authorization}`,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {}).finally(() => {
        telemetryPendingRef.current.delete(request);
      });
      telemetryPendingRef.current.add(request);
    } catch {}
  }, [session]);

  const sendTimeLimitMessage = useCallback((text: string) => {
    try {
      callRef.current?.sendAppMessage?.({
        event_type: "conversation.echo",
        eventType: "conversation.echo",
        properties: { text },
      }, "*");
    } catch {}
  }, []);

  const sendTimeWarning = useCallback((remaining: number) => {
    if (timeWarningSentRef.current || endTriggeredRef.current) return;
    timeWarningSentRef.current = true;
    setTimeNotice(TIME_WARNING_NOTICE);
    sendTimeLimitMessage(TIME_WARNING_TEXT);
    console.log("[InterviewCviPage] time_warning_sent", { remaining_seconds: remaining });
  }, [sendTimeLimitMessage]);

  const requestGracefulWrap = useCallback((remaining: number) => {
    if (gracefulWrapSentRef.current || endTriggeredRef.current) return;
    gracefulWrapSentRef.current = true;
    setTimeNotice(GRACEFUL_WRAP_NOTICE);
    sendTimeLimitMessage(GRACEFUL_WRAP_TEXT);
    console.log("[InterviewCviPage] graceful_wrap_requested", { remaining_seconds: remaining });
    if (!gracefulForceEndTimerRef.current) {
      gracefulForceEndTimerRef.current = window.setTimeout(() => {
        gracefulForceEndTimerRef.current = null;
        void endInterview("time_limit_graceful_close");
      }, GRACEFUL_FORCE_END_DELAY_MS);
    }
  }, [endInterview, sendTimeLimitMessage]);

  useEffect(() => () => clearAutoEndTimers(), [clearAutoEndTimers]);

  useEffect(() => {
    const onPageHide = () => {
      if (!endTriggeredRef.current) {
        sendLifecycleTelemetry(
          "browser_closed_or_navigation",
          { terminal_reason: "browser_closed_or_navigation" },
          { reason: "browser_closed_or_navigation", terminal: true },
        );
      }
    };
    const onOnline = () => sendLifecycleTelemetry("browser_online", { network_state: "online" });
    const onOffline = () => sendLifecycleTelemetry("browser_offline", { network_state: "offline" });
    const onVisibilityChange = () => sendLifecycleTelemetry("browser_visibility_changed", {
      visibility_state:
        document.visibilityState === "visible" ||
        document.visibilityState === "hidden" ||
        document.visibilityState === "prerender"
          ? document.visibilityState
          : "unknown",
    });
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [sendLifecycleTelemetry]);

  useEffect(() => {
    if (!session?.conversation_url) {
      setLocation("/interview");
    }
  }, [session, setLocation]);

  useEffect(() => {
    if (!session?.conversation_url) return;

    let alive = true;
    let call: DailyCallObject | null = null;
    let handlers: Array<[string, (event?: DailyEvent) => void]> = [];
    let progressWatchdogTimer: number | null = null;
    let progressRecoveryDeadlineTimer: number | null = null;
    let previousRemoteEvidence: RemoteParticipantEvidence | null = null;

    const register = (event: string, handler: (payload?: DailyEvent) => void) => {
      call?.on(event, handler);
      handlers.push([event, handler]);
    };
    const requestRecordingStart = async () => {
      if (!alive || recordingStartRequestedRef.current) return;
      recordingStartRequestedRef.current = true;
      const logContext = {
        conversation_id: session.conversation_id || null,
        interview_id: session.interview_id || null,
      };
      if (!call || typeof call.startRecording !== "function") {
        console.warn("[daily-recording] start_unavailable", logContext);
        return;
      }
      console.log("[daily-recording] start_requested", logContext);
      try {
        await call.startRecording();
        console.log("[daily-recording] start_success", logContext);
      } catch (error) {
        console.warn("[daily-recording] start_failed", { ...logContext, error });
      }
    };
    const applySelectedDevices = async () => {
      if (!call) return;
      const devices: { videoDeviceId?: string; audioDeviceId?: string } = {};
      if (session.selectedCameraDeviceId) devices.videoDeviceId = session.selectedCameraDeviceId;
      if (session.selectedMicrophoneDeviceId) devices.audioDeviceId = session.selectedMicrophoneDeviceId;
      if (!devices.videoDeviceId && !devices.audioDeviceId) return;

      try {
        if (typeof call.setInputDevicesAsync === "function") {
          await call.setInputDevicesAsync(devices);
          return;
        }
        if (typeof call.setInputDevices === "function") {
          await call.setInputDevices(devices);
          return;
        }
        console.warn("[InterviewCviPage] Daily input device selection unsupported; using defaults.");
      } catch (error) {
        console.warn("[InterviewCviPage] Could not apply selected input devices; using defaults.", error);
      }
    };

    const beginStartupWatchdog = () => {
      clearStartupTimer();
      startupTimerRef.current = window.setTimeout(async () => {
        if (!alive || startupRemoteSeenRef.current || !call) return;
        if (!startupRecoveryAttemptedRef.current) {
          startupRecoveryAttemptedRef.current = true;
          reconnectingRef.current = true;
          try {
            await call.leave().catch(() => {});
            if (!alive || endTriggeredRef.current) return;
            await call.join({
              url: session.conversation_url,
              userName: "Candidate",
              startAudioOff: false,
              startVideoOff: false,
            });
            if (!alive || endTriggeredRef.current) return;
            beginStartupWatchdog();
            return;
          } catch {
          } finally {
            reconnectingRef.current = false;
          }
        }
        setLoading(false);
        setError("Interview did not start correctly. Please relaunch and try again.");
      }, STARTUP_REMOTE_TIMEOUT_MS);
    };

    const stopProgressWatchdog = () => {
      if (progressWatchdogTimer) {
        window.clearInterval(progressWatchdogTimer);
        progressWatchdogTimer = null;
      }
    };

    const clearProgressRecoveryDeadline = () => {
      if (progressRecoveryDeadlineTimer) {
        window.clearTimeout(progressRecoveryDeadlineTimer);
        progressRecoveryDeadlineTimer = null;
      }
    };

    const transitionRecovery = (event: ReconnectRecoveryEvent) => {
      const previous = progressRecoveryStateRef.current;
      const next = advanceReconnectRecovery(previous, event);
      progressRecoveryStateRef.current = next;
      if (next !== previous && (isReconnectRecoveryActive(next) || next.phase === "recovered")) {
        setConnectionNotice(reconnectRecoveryNotice(next));
      }
      return { previous, next };
    };

    const boundedElapsed = (startAt: number | null, endAt: number) => (
      startAt === null ? 0 : Math.min(3_600_000, Math.max(0, Math.round(endAt - startAt)))
    );

    const recoveryMetadata = (state = progressRecoveryStateRef.current): ReliabilityMetadata => ({
      recovery_attempt: state.attempt,
      recovery_phase: state.phase,
      is_recovery_active: isReconnectRecoveryActive(state),
    });

    const remoteStateMetadata = (): ReliabilityMetadata => {
      const evidence = previousRemoteEvidence || {
        remotePresent: false,
        remoteAudioReady: false,
        remoteVideoReady: false,
        remoteParticipantCount: 0,
      };
      return {
        participant_count: evidence.remoteParticipantCount,
        remote_participant_present: evidence.remotePresent,
        remote_audio_state: remoteMediaState(evidence.remoteAudioReady, evidence.remotePresent),
        remote_video_state: remoteMediaState(evidence.remoteVideoReady, evidence.remotePresent),
      };
    };

    const recordProgressCheckpoint = (
      source: "replica_started_speaking" | "replica_utterance" | "candidate_utterance",
      progressAt: number,
      resetSource: "progress_checkpoint" | "reconnect_practical_progress" = "progress_checkpoint",
    ) => {
      const priorProgressAt = lastProgressAtRef.current;
      lastProgressAtRef.current = progressAt;
      sendLifecycleTelemetry("progress_checkpoint_updated", {
        progress_source: source,
        elapsed_ms: boundedElapsed(priorProgressAt, progressAt),
        watchdog_reset_source: resetSource,
        ...recoveryMetadata(),
      });
    };

    const recordReconnectLocalJoin = (at: number) => {
      const { previous, next } = transitionRecovery({ type: "local_joined", at });
      if (previous === next || next.phase !== "awaiting_remote_presence") return;
      sendLifecycleTelemetry("reconnect_local_joined", {
        meeting_state: "joined",
        recovery_age_ms: boundedElapsed(next.startedAt, at),
        ...recoveryMetadata(next),
      });
    };

    const markProgressStalled = (reason: "watchdog_timeout" | "reconnect_failed") => {
      if (!alive || endTriggeredRef.current) return;
      clearProgressRecoveryDeadline();
      progressRecoveryInFlightRef.current = false;
      reconnectingRef.current = false;
      stopProgressWatchdog();
      setLoading(false);
      setConnectionNotice("");
      setProgressStalled(true);
      setError("The interview stopped progressing and cannot continue. Please contact support before trying again.");
      const at = Date.now();
      sendLifecycleTelemetry(
        "interview_terminal_requested",
        {
          terminal_reason: reason,
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, at),
          recovery_age_ms: boundedElapsed(progressRecoveryStateRef.current.startedAt, at),
          ...remoteStateMetadata(),
          ...recoveryMetadata(),
        },
        { reason, terminal: true },
      );
      sendLifecycleTelemetry(
        reason === "watchdog_timeout" ? "watchdog_timeout" : "reconnect_failed",
        {
          terminal_reason: reason,
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, at),
          ...remoteStateMetadata(),
          ...recoveryMetadata(),
        },
        { reason },
      );
      void endInterview(reason, true);
    };

    const failProgressRecovery = (event: Extract<ReconnectRecoveryEvent, { type: "deadline" | "join_failed" }>) => {
      const { previous, next } = transitionRecovery(event);
      if (previous === next || next.phase !== "failed") return;
      markProgressStalled("reconnect_failed");
    };

    const beginProgressRecoveryDeadline = () => {
      if (progressRecoveryDeadlineTimer) return;
      progressRecoveryDeadlineTimer = window.setTimeout(() => {
        progressRecoveryDeadlineTimer = null;
        if (!alive || endTriggeredRef.current) return;
        const at = Date.now();
        sendLifecycleTelemetry("watchdog_deadline_evaluated", {
          watchdog_evaluation: "recovery_deadline_expired",
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, at),
          recovery_age_ms: boundedElapsed(progressRecoveryStateRef.current.startedAt, at),
          ...remoteStateMetadata(),
          ...recoveryMetadata(),
        });
        failProgressRecovery({ type: "deadline", at });
      }, RECOVERY_PROGRESS_TIMEOUT_MS);
    };

    const observeRecoveryRemoteState = (evidence: RemoteParticipantEvidence) => {
      if (!isReconnectRecoveryActive(progressRecoveryStateRef.current)) return;
      transitionRecovery({
        type: "remote_state",
        at: Date.now(),
        ...evidence,
      });
    };

    const syncParticipantsWithDiagnostics = (participants?: Record<string, DailyParticipant>) => {
      const evidence = syncParticipants(participants);
      observeRecoveryRemoteState(evidence);
      const state = progressRecoveryStateRef.current;
      const events = deriveRemoteDiagnosticEvents(previousRemoteEvidence, evidence, {
        recoveryActive: isReconnectRecoveryActive(state),
        recoveryAttempt: state.attempt,
        recoveryPhase: state.phase,
      });
      previousRemoteEvidence = evidence;
      for (const diagnostic of events) {
        sendLifecycleTelemetry(diagnostic.event, diagnostic.metadata);
      }
      return evidence;
    };

    const completeProgressRecovery = (source: ReconnectProgressSource, progressAt: number) => {
      const { previous, next } = transitionRecovery({
        type: "practical_progress",
        at: progressAt,
        source,
      });
      if (previous === next || next.phase !== "recovered") return false;
      clearProgressRecoveryDeadline();
      progressRecoveryInFlightRef.current = false;
      reconnectingRef.current = false;
      sendLifecycleTelemetry("reconnect_practical_progress", {
        progress_source: source,
        recovery_age_ms: boundedElapsed(next.startedAt, progressAt),
        ...recoveryMetadata(next),
      });
      recordProgressCheckpoint(source, progressAt, "reconnect_practical_progress");
      sendLifecycleTelemetry("reconnect_succeeded", {
        progress_source: source,
        recovery_age_ms: boundedElapsed(next.startedAt, progressAt),
        remote_participant_present: next.remotePresent,
        remote_audio_state: next.remoteAudioReady ? "playable" : "unavailable",
        remote_video_state: next.remoteVideoReady ? "playable" : "unavailable",
        ...recoveryMetadata(next),
      });
      return true;
    };

    const beginProgressWatchdog = () => {
      stopProgressWatchdog();
      sendLifecycleTelemetry("watchdog_started", {
        recovery_attempt: progressRecoveryStateRef.current.attempt,
        recovery_phase: progressRecoveryStateRef.current.phase,
        is_recovery_active: false,
      });
      progressWatchdogTimer = window.setInterval(async () => {
        if (!alive || endTriggeredRef.current) {
          stopProgressWatchdog();
          return;
        }
        if (
          !progressObservedRef.current ||
          progressRecoveryInFlightRef.current ||
          isReconnectRecoveryActive(progressRecoveryStateRef.current) ||
          !call
        ) {
          return;
        }

        const lastProgressAt = lastProgressAtRef.current;
        if (!lastProgressAt || Date.now() - lastProgressAt < PROGRESS_STALL_MS) return;
        // Allow a full candidate-engagement grace interval after the AI has
        // finished speaking before treating silence as a stalled conversation.
        if (lastAiSpeechStoppedAtRef.current && Date.now() - lastAiSpeechStoppedAtRef.current < IDLE_ENGAGEMENT_GRACE_MS) return;

        if (progressRecoveryAttemptedRef.current) {
          const at = Date.now();
          sendLifecycleTelemetry("watchdog_deadline_evaluated", {
            watchdog_evaluation: "post_recovery_progress_stale",
            progress_age_ms: boundedElapsed(lastProgressAtRef.current, at),
            recovery_age_ms: boundedElapsed(progressRecoveryStateRef.current.startedAt, at),
            ...remoteStateMetadata(),
            ...recoveryMetadata(),
          });
          markProgressStalled("watchdog_timeout");
          return;
        }

        const recoveryStartedAt = Date.now();
        sendLifecycleTelemetry("watchdog_deadline_evaluated", {
          watchdog_evaluation: "recovery_threshold_reached",
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, recoveryStartedAt),
          ...remoteStateMetadata(),
          recovery_attempt: 0,
          recovery_phase: "idle",
          is_recovery_active: false,
        });
        progressRecoveryAttemptedRef.current = true;
        progressRecoveryInFlightRef.current = true;
        reconnectingRef.current = true;
        transitionRecovery({ type: "start", at: recoveryStartedAt });
        previousRemoteEvidence = {
          remotePresent: false,
          remoteAudioReady: false,
          remoteVideoReady: false,
          remoteParticipantCount: 0,
        };
        beginProgressRecoveryDeadline();
        sendLifecycleTelemetry("reconnect_started", {
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, recoveryStartedAt),
          meeting_state: "reconnecting",
          ...recoveryMetadata(),
        }, { reason: "watchdog_timeout" });
        sendLifecycleTelemetry("reconnect_attempted", {
          progress_age_ms: boundedElapsed(lastProgressAtRef.current, recoveryStartedAt),
          ...recoveryMetadata(),
        }, { reason: "watchdog_timeout" });
        try {
          await call.leave().catch(() => {});
          if (!alive || endTriggeredRef.current) return;
          await call.join({
            url: session.conversation_url,
            userName: "Candidate",
            startAudioOff: false,
            startVideoOff: false,
          });
          if (!alive || endTriggeredRef.current) return;
          recordReconnectLocalJoin(Date.now());
          syncParticipantsWithDiagnostics();
        } catch {
          failProgressRecovery({ type: "join_failed", at: Date.now() });
        } finally {
          reconnectingRef.current = false;
          if (!isReconnectRecoveryActive(progressRecoveryStateRef.current)) {
            progressRecoveryInFlightRef.current = false;
          }
        }
      }, PROGRESS_WATCHDOG_INTERVAL_MS);
    };

    (async () => {
      try {
        setLoading(true);
        setError("");
        startupRemoteSeenRef.current = false;
        startupRecoveryAttemptedRef.current = false;
        recordingStartRequestedRef.current = false;
        reconnectingRef.current = false;
        progressObservedRef.current = false;
        lastProgressAtRef.current = null;
        progressRecoveryAttemptedRef.current = false;
        progressRecoveryInFlightRef.current = false;
        progressRecoveryStateRef.current = createReconnectRecoveryState();
        lastAiSpeechAtRef.current = null;
        lastAiSpeechStoppedAtRef.current = null;

        const daily = await loadDailySdk();
        if (!alive) return;

        call = daily.createCallObject();
        callRef.current = call;

        register("joined-meeting", () => {
          if (!alive || endTriggeredRef.current) return;
          setLoading(false);
          if (progressRecoveryStateRef.current.phase === "reconnecting_transport") {
            recordReconnectLocalJoin(Date.now());
          }
          sendLifecycleTelemetry("daily_participant_joined", {
            participant_role: "candidate",
            meeting_state: "joined",
            ...recoveryMetadata(),
          });
          syncParticipantsWithDiagnostics();
          void requestRecordingStart();
        });
        const syncParticipantEvent = (event?: DailyEvent) => {
          if (!alive || endTriggeredRef.current) return;
          syncParticipantsWithDiagnostics(event?.participants);
        };
        register("participant-joined", syncParticipantEvent);
        register("participant-updated", syncParticipantEvent);
        register("participant-left", syncParticipantEvent);
        register("track-started", syncParticipantEvent);
        register("track-stopped", syncParticipantEvent);
        register("left-meeting", () => {
          if (!alive || leavingRef.current || reconnectingRef.current) return;
          sendLifecycleTelemetry("daily_participant_left", {
            participant_role: "candidate",
            meeting_state: "left",
            ...recoveryMetadata(),
          });
          if (isReconnectRecoveryActive(progressRecoveryStateRef.current)) {
            failProgressRecovery({ type: "join_failed", at: Date.now() });
            return;
          }
          void leaveLiveRoute();
        });
        register("error", () => {
          if (!alive || endTriggeredRef.current) return;
          if (isReconnectRecoveryActive(progressRecoveryStateRef.current)) {
            failProgressRecovery({ type: "join_failed", at: Date.now() });
            return;
          }
          setError("Interview encountered an issue. Please finish and relaunch.");
        });
        register("camera-error", () => {
          if (!alive || endTriggeredRef.current) return;
          setError("Camera or microphone access failed. Please allow permissions and relaunch.");
        });
        register("app-message", (event) => {
          if (!alive || endTriggeredRef.current) return;
          const data = event?.data ?? event ?? {};
          const eventType = String(data?.event_type || data?.eventType || "").toLowerCase();
          const utteranceRole = String(data?.properties?.role || data?.role || "").toLowerCase();
          const speech = String(data?.properties?.speech || data?.properties?.text || data?.speech || data?.text || "");
          const isReplicaUtterance =
            eventType === "conversation.utterance" &&
            (utteranceRole === "replica" || utteranceRole === "assistant" || utteranceRole === "agent");
          const isCandidateUtterance =
            eventType === "conversation.utterance" &&
            (utteranceRole === "candidate" || utteranceRole === "user" || utteranceRole === "participant");
          const isReplicaSpeaking =
            eventType === "conversation.started_speaking" &&
            (utteranceRole === "replica" || utteranceRole === "assistant" || utteranceRole === "agent");
          const recoveryWasActive = isReconnectRecoveryActive(progressRecoveryStateRef.current);
          if (recoveryWasActive) {
            syncParticipantsWithDiagnostics();
          }
          const progressAt = Date.now();
          const progressSource = isReplicaSpeaking
            ? "replica_started_speaking"
            : isReplicaUtterance
              ? "replica_utterance"
              : isCandidateUtterance
                ? "candidate_utterance"
                : null;
          if (
            eventType === "conversation.started_speaking" ||
            eventType === "conversation.stopped_speaking" ||
            eventType === "conversation.utterance" ||
            eventType === "conversation.tool_call" ||
            eventType === "conversation.toolcall"
          ) {
            sendLifecycleTelemetry("app_message_received", {
              participant_role:
                isReplicaSpeaking || isReplicaUtterance
                  ? "replica"
                  : isCandidateUtterance
                    ? "candidate"
                    : "unknown",
              ...(progressSource ? { progress_source: progressSource } : {}),
              ...recoveryMetadata(),
            });
          }
          let recoveryCompleted = false;
          if (isReplicaSpeaking) {
            lastAiSpeechAtRef.current = progressAt;
            recoveryCompleted = completeProgressRecovery("replica_started_speaking", progressAt);
            if (!recoveryWasActive) recordProgressCheckpoint("replica_started_speaking", progressAt);
          }
          if (eventType === "conversation.stopped_speaking" && (utteranceRole === "replica" || utteranceRole === "assistant" || utteranceRole === "agent")) {
            lastAiSpeechStoppedAtRef.current = progressAt;
          }
          if (eventType === "conversation.utterance") {
            if (isReplicaUtterance || (isCandidateUtterance && isCandidateAnswerProgress(speech))) {
              progressObservedRef.current = true;
              if (isReplicaUtterance && !recoveryCompleted) {
                recoveryCompleted = completeProgressRecovery("replica_utterance", progressAt);
              }
              if (!recoveryWasActive) {
                recordProgressCheckpoint(
                  isReplicaUtterance ? "replica_utterance" : "candidate_utterance",
                  progressAt,
                );
              }
              if (!recoveryWasActive) setConnectionNotice("");
            }
          }
          if (eventType === "conversation.tool_call" || eventType === "conversation.toolcall") {
            const toolName = String(
              data?.name ??
              data?.tool?.name ??
              data?.tool_name ??
              data?.tool?.function?.name ??
              data?.function?.name ??
              "",
            ).trim().toLowerCase();
            if (toolName === "end_interview") {
              void endInterview("tool_call");
              return;
            }
          }
          const speechLower = speech.toLowerCase();
          if (
            isReplicaUtterance &&
            (
              speechLower.includes("concludes the interview") ||
              speechLower.includes("ending the session") ||
              speechLower.includes("end the session") ||
              speechLower.includes("ending the interview") ||
              speechLower.includes("end the interview")
            ) &&
            !closeEndTimerRef.current
          ) {
            closeEndTimerRef.current = window.setTimeout(() => {
              closeEndTimerRef.current = null;
              void endInterview("completed_normally");
            }, CLOSING_UTTERANCE_END_DELAY_MS);
            return;
          }
          const payloadText = JSON.stringify(data || {}).toLowerCase();
          if (/call_ended|call-ended|meeting-ended|meeting_ended|room_left|room-left|session_ended|session-ended|conversation_ended|conversation-ended|interview_ended|interview-ended/.test(payloadText)) {
            void endInterview("vendor_end_event");
          }
        });

        await applySelectedDevices();
        beginStartupWatchdog();
        await call.join({
          url: session.conversation_url,
          userName: "Candidate",
          startAudioOff: false,
          startVideoOff: false,
        });
        if (!alive) return;
        syncParticipantsWithDiagnostics();
        beginProgressWatchdog();
      } catch {
        if (!alive) return;
        setLoading(false);
        setError("Interview did not start correctly. Please relaunch and try again.");
      }
    })();

    return () => {
      alive = false;
      clearStartupTimer();
      stopProgressWatchdog();
      clearProgressRecoveryDeadline();
      reconnectingRef.current = false;
      progressRecoveryInFlightRef.current = false;
      if (call?.off) {
        for (const [eventName, handler] of handlers) {
          try {
            call.off(eventName, handler);
          } catch {}
        }
      }
      handlers = [];
      void teardownCall();
    };
  }, [clearStartupTimer, endInterview, leaveLiveRoute, sendLifecycleTelemetry, session, syncParticipants, teardownCall]);

  useEffect(() => {
    const maxMinutes = session?.max_interview_minutes;
    if (!maxMinutes || maxMinutes <= 0) {
      setSecondsRemaining(null);
      setTimeNotice("");
      return;
    }

    startMsRef.current = Date.now();
    let timer: number | null = null;
    const maxSeconds = maxMinutes * 60;
    const shouldUseTwoMinuteWarning = maxSeconds > TIME_WARNING_THRESHOLD_SECONDS;
    const gracefulWrapThreshold =
      maxSeconds > GRACEFUL_WRAP_THRESHOLD_SECONDS
        ? GRACEFUL_WRAP_THRESHOLD_SECONDS
        : maxSeconds > FORCE_END_THRESHOLD_SECONDS + 10
          ? FORCE_END_THRESHOLD_SECONDS + 10
          : null;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMsRef.current) / 1000);
      const remaining = Math.max(maxSeconds - elapsed, 0);
      setSecondsRemaining(remaining);
      if (endTriggeredRef.current) {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
        return;
      }
      if (shouldUseTwoMinuteWarning && remaining > 0 && remaining <= TIME_WARNING_THRESHOLD_SECONDS) {
        sendTimeWarning(remaining);
      }
      if (gracefulWrapThreshold != null && remaining > 0 && remaining <= gracefulWrapThreshold) {
        requestGracefulWrap(remaining);
      }
      if (remaining <= FORCE_END_THRESHOLD_SECONDS) {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
        console.log("[InterviewCviPage] force_close_triggered", { remaining_seconds: remaining });
        void endInterview("time_limit_force_close");
      }
    };

    tick();
    timer = window.setInterval(tick, 1000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [endInterview, requestGracefulWrap, sendTimeWarning, session?.max_interview_minutes]);

  useEffect(() => {
    if (!backendBase || !session?.interview_id || !session?.role_token) return;

    let alive = true;
    const poll = async () => {
      try {
        const qs = new URLSearchParams({
          interview_id: String(session.interview_id),
          role_token: String(session.role_token),
        });
        const resp = await fetch(joinUrl(backendBase, `/public/interview-status?${qs.toString()}`));
        const data = await resp.json().catch(() => ({}));
        if (!alive || !resp.ok) return;
        const status = String(data?.status || "");
        if (status === "ending_requested" || status === "Ended") {
          await leaveLiveRoute();
        }
      } catch {}
    };

    poll();
    const timer = window.setInterval(poll, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [leaveLiveRoute, session]);

  const finishInterview = useCallback(async () => {
    if (finishBusy || !session) return;
    setFinishBusy(true);
    setError("");
    await endInterview("manual");
  }, [endInterview, finishBusy, session]);

  const exitFailedInterview = useCallback(() => {
    try {
      window.sessionStorage.removeItem(LIVE_STATE_KEY);
    } catch {}
    const roleToken = String(session?.role_token || "").trim();
    setLocation(roleToken ? `/interview/${encodeURIComponent(roleToken)}` : "/interview");
  }, [session?.role_token, setLocation]);

  const timerLabel = useMemo(() => formatCountdown(secondsRemaining), [secondsRemaining]);
  const timerToneClass = useMemo(() => {
    if (typeof secondsRemaining !== "number") return "bg-black/60 border-white/20 text-white";
    if (secondsRemaining <= 60) return "bg-[#EF4444]/90 border-[#DC2626] text-white";
    if (secondsRemaining <= 120) return "bg-[#FBBF24]/90 border-[#F59E0B] text-[#3A2600]";
    return "bg-black/60 border-white/20 text-white";
  }, [secondsRemaining]);
  const candidateAssistanceContact = useMemo(
    () => String(session?.candidate_assistance_contact || "").trim(),
    [session?.candidate_assistance_contact],
  );
  const candidateAssistanceHref = useMemo(() => {
    if (!candidateAssistanceContact) return "";
    if (candidateAssistanceContact.includes("@")) return `mailto:${candidateAssistanceContact}`;
    const digits = candidateAssistanceContact.replace(/[^\d]/g, "");
    if (digits.length >= 7) return `tel:${candidateAssistanceContact}`;
    return "";
  }, [candidateAssistanceContact]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <header
        className="bg-white flex-shrink-0 flex items-center px-6 h-14"
        style={{ borderBottom: "1px solid rgba(10,21,71,0.07)" }}
      >
        <img src={alphaSourceLogo} alt="alphaSource AI" className="h-8 w-auto" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div
          className="w-full max-w-6xl bg-white rounded-2xl p-4 sm:p-5"
          style={{
            border: "1px solid rgba(10,21,71,0.07)",
            boxShadow: "0 4px 24px rgba(10,21,71,0.08)",
          }}
        >
          <div
            className="relative w-full rounded-2xl border border-[rgba(10,21,71,0.10)] bg-black overflow-hidden"
            style={{ aspectRatio: "16 / 9" }}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover bg-black"
            />
            <audio ref={remoteAudioRef} autoPlay />

            <div
              className={`absolute bottom-4 right-4 w-40 h-28 rounded-lg overflow-hidden border border-white/20 bg-[#0A1547] ${
                hasLocalVideo ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {(!hasRemoteVideo || loading) && (
              <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm font-semibold">
                Connecting interview…
              </div>
            )}

            {!loading && error && (
              <div className="absolute inset-0 flex items-center justify-center text-center px-6 bg-black/35">
                <p className="text-red-200 text-sm font-semibold">{error}</p>
              </div>
            )}

            {timerLabel && (
              <div className={`absolute top-3 right-3 px-3 py-1 rounded-full border text-[11px] font-bold tracking-wide ${timerToneClass}`}>
                {timerLabel}
              </div>
            )}

            {(connectionNotice || timeNotice) && (
              <div className="absolute top-3 left-3 max-w-[calc(100%-8rem)] px-3 py-2 rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB]/95 text-[#3A2600] text-[11px] sm:text-xs font-bold shadow-sm pointer-events-none">
                {connectionNotice || timeNotice}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors border border-[rgba(10,21,71,0.14)] text-[#0A1547] hover:bg-white"
            >
              Need help?
            </button>
            {progressStalled ? (
              <button
                type="button"
                onClick={exitFailedInterview}
                className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ backgroundColor: "#A380F6" }}
              >
                Exit interview
              </button>
            ) : (
              <button
                type="button"
                onClick={finishInterview}
                disabled={finishBusy}
                className="flex items-center gap-2.5 px-6 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ backgroundColor: "#A380F6" }}
              >
                {finishBusy ? "Finishing..." : "Finish Interview"}
              </button>
            )}
          </div>

          {!loading && error && (
            <p className="mt-3 text-center text-xs font-semibold text-red-500">{error}</p>
          )}
        </div>
      </main>

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[1px]">
          <div
            className="w-full max-w-md bg-white rounded-2xl p-5 sm:p-6"
            style={{
              border: "1px solid rgba(10,21,71,0.10)",
              boxShadow: "0 12px 40px rgba(10,21,71,0.16)",
            }}
          >
            <h2 className="text-base sm:text-lg font-black text-[#0A1547] mb-3">Need help?</h2>
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-[#0A1547]/75 leading-relaxed">
                <span className="font-bold text-[#0A1547]">Technical issues with the platform:</span>{" "}
                <a href="mailto:info@alphasourceai.com" className="text-[#A380F6] hover:underline font-semibold">
                  info@alphasourceai.com
                </a>
              </p>
              <p className="text-xs sm:text-sm text-[#0A1547]/75 leading-relaxed">
                <span className="font-bold text-[#0A1547]">Questions about the role or interview process:</span>{" "}
                {candidateAssistanceContact ? (
                  candidateAssistanceHref ? (
                    <a href={candidateAssistanceHref} className="text-[#A380F6] hover:underline font-semibold">
                      {candidateAssistanceContact}
                    </a>
                  ) : (
                    <span className="font-semibold text-[#0A1547]">{candidateAssistanceContact}</span>
                  )
                ) : (
                  <span className="text-[#0A1547]/60">Please contact your hiring team.</span>
                )}
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#A380F6" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
