export type MicrophoneLevelSample = {
  at: number;
  rms: number;
};

type RecorderResource = {
  state: string;
  ondataavailable: ((event: BlobEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onstart: ((event: Event) => void) | null;
  onstop: ((event: Event) => void) | null;
  stop: () => void;
};

type TrackResource = {
  stop: () => void;
};

export function voicedMilliseconds(
  samples: MicrophoneLevelSample[],
  readyRms: number,
  maximumSampleGapMs = 100,
): number {
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (current.rms >= readyRms) {
      total += Math.min(maximumSampleGapMs, Math.max(0, current.at - previous.at));
    }
  }
  return total;
}

export function sustainedVoiceDetected(
  samples: MicrophoneLevelSample[],
  readyRms: number,
  requiredVoicedMs: number,
): boolean {
  return voicedMilliseconds(samples, readyRms) >= requiredVoicedMs;
}

export function releaseMicrophoneSampleResources({
  recorder,
  sampleTrack,
  sampleUrl,
  revokeObjectUrl,
}: {
  recorder?: RecorderResource | null;
  sampleTrack?: TrackResource | null;
  sampleUrl?: string;
  revokeObjectUrl?: (url: string) => void;
}): void {
  if (recorder) {
    try { recorder.ondataavailable = null; } catch { /* continue cleanup */ }
    try { recorder.onerror = null; } catch { /* continue cleanup */ }
    try { recorder.onstart = null; } catch { /* continue cleanup */ }
    try { recorder.onstop = null; } catch { /* continue cleanup */ }
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      // Teardown must continue even if the recorder changed state concurrently.
    }
  }
  try { sampleTrack?.stop(); } catch { /* continue cleanup */ }
  if (sampleUrl && revokeObjectUrl) {
    try { revokeObjectUrl(sampleUrl); } catch { /* continue cleanup */ }
  }
}
