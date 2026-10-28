export interface ScoringSummary { version: string; role_answers: number; answer_quality: number; overall: number; answer_quality_scores: Record<string, number>; }
export function normalizeScoringSummary(value: unknown): ScoringSummary | null;
export function qualityAnalysisForDisplay(value: unknown, summary: ScoringSummary | null, version?: unknown): unknown;
