export const INTERVIEW_LOCAL_CLOSING_TEXT =
  "We are out of time. Thank you for your time. I am ending the session now.";

export const INTERVIEW_LOCAL_CLOSING_ASSET = "/media/interview-closing-final.mp3";
export const INTERVIEW_LOCAL_CLOSING_DURATION_MS = 4519;
export const INTERVIEW_LOCAL_CLOSING_FALLBACK_MS = 6000;

export type LocalClosingPrimeResult =
  | "primed"
  | "prime_failed"
  | "unavailable";

export type LocalClosingPlaybackResult =
  | "started"
  | "duplicate"
  | "play_failed"
  | "unavailable";

type ClosingAudioLike = Pick<
  HTMLAudioElement,
  | "addEventListener"
  | "removeEventListener"
  | "load"
  | "pause"
  | "play"
  | "preload"
  | "src"
  | "muted"
  | "volume"
  | "currentTime"
>;

type ClosingAudioFactory = (src: string) => ClosingAudioLike;

export type LocalClosingPlaybackHandlers = {
  onStarted: () => void;
  onEnded: () => void;
  onFailed: (category: "play_failed") => void;
};

export type LocalClosingAudioController = {
  preload: () => boolean;
  prime: () => Promise<LocalClosingPrimeResult>;
  playOnce: (handlers: LocalClosingPlaybackHandlers) => Promise<LocalClosingPlaybackResult>;
  resetForNewInterview: () => void;
  element: () => ClosingAudioLike | null;
};

export function createLocalClosingAudioController(
  factory: ClosingAudioFactory,
): LocalClosingAudioController {
  let audio: ClosingAudioLike | null = null;
  let playInvoked = false;
  let primeAttempted = false;

  const ensure = () => {
    if (audio) return audio;
    try {
      audio = factory(INTERVIEW_LOCAL_CLOSING_ASSET);
      audio.src = INTERVIEW_LOCAL_CLOSING_ASSET;
      audio.preload = "auto";
      audio.load();
      return audio;
    } catch {
      audio = null;
      return null;
    }
  };

  return {
    preload() {
      return Boolean(ensure());
    },
    async prime() {
      const element = ensure();
      if (!element) return "unavailable";
      primeAttempted = true;
      try {
        element.pause();
        element.currentTime = 0;
        // The trusted Start Interview gesture invokes play on the exact
        // element reused at 0:00. Keep it inaudible with zero volume without
        // converting this into a muted-autoplay path.
        element.muted = false;
        element.volume = 0;
        await element.play();
        element.pause();
        element.currentTime = 0;
        element.muted = false;
        element.volume = 1;
        return "primed";
      } catch {
        try {
          element.pause();
          element.currentTime = 0;
          element.muted = false;
          element.volume = 1;
        } catch {}
        return "prime_failed";
      }
    },
    async playOnce(handlers) {
      if (playInvoked) return "duplicate";
      playInvoked = true;
      const element = ensure();
      if (!element) {
        handlers.onFailed("play_failed");
        return "unavailable";
      }
      let started = false;
      let settled = false;
      const cleanup = () => {
        element.removeEventListener("playing", onPlaying);
        element.removeEventListener("ended", onEnded);
        element.removeEventListener("error", onError);
      };
      const onPlaying = () => {
        if (started || settled) return;
        started = true;
        handlers.onStarted();
      };
      const onEnded = () => {
        if (settled) return;
        settled = true;
        cleanup();
        handlers.onEnded();
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        handlers.onFailed("play_failed");
      };
      element.addEventListener("playing", onPlaying);
      element.addEventListener("ended", onEnded);
      element.addEventListener("error", onError);
      try {
        element.pause();
        element.currentTime = 0;
        element.muted = false;
        element.volume = 1;
        await element.play();
        onPlaying();
        return "started";
      } catch {
        onError();
        return "play_failed";
      }
    },
    resetForNewInterview() {
      playInvoked = false;
      if (!primeAttempted) return;
      try {
        audio?.pause();
        if (audio) audio.currentTime = 0;
      } catch {}
    },
    element() {
      return audio;
    },
  };
}

const browserAudioFactory: ClosingAudioFactory = (src) => new Audio(src);
const browserController = createLocalClosingAudioController(browserAudioFactory);

export function preloadLocalClosingAudio(): boolean {
  if (typeof Audio === "undefined") return false;
  return browserController.preload();
}

export function primeLocalClosingAudio(): Promise<LocalClosingPrimeResult> {
  if (typeof Audio === "undefined") return Promise.resolve("unavailable");
  browserController.resetForNewInterview();
  return browserController.prime();
}

export function playLocalClosingAudioOnce(
  handlers: LocalClosingPlaybackHandlers,
): Promise<LocalClosingPlaybackResult> {
  if (typeof Audio === "undefined") {
    handlers.onFailed("play_failed");
    return Promise.resolve("unavailable");
  }
  return browserController.playOnce(handlers);
}

export function localClosingAudioElementForTests(): ClosingAudioLike | null {
  return browserController.element();
}
