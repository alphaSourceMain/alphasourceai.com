export interface DemoIdentity { id: string; name: string; lane: number; color: string; baseline: number; }
export interface DemoRow extends DemoIdentity { cents: number; }
export interface RankedDemoRow extends DemoRow { rank: number; position: number; }
export interface ContestState { snapshot: 'A' | 'B'; animate: boolean; start: string; end: string; status: string; dateError: string; }
export function rankDemo(rows: unknown): RankedDemoRow[];
export function money(cents: number): string;
export function sumCents(rows: Pick<DemoRow, 'cents'>[]): number;
export function validCivilDate(value: unknown): boolean;
export function validRange(start: unknown, end: unknown): boolean;
export function periodLabel(start: string, end: string): string;
export function fixture(amounts: unknown): DemoRow[];
export const identities: readonly Readonly<DemoIdentity>[];
export const snapshots: Readonly<Record<'A' | 'B', readonly Readonly<DemoRow>[]>>;
export function selectSnapshot(state: ContestState, key: 'A' | 'B'): ContestState;
export function applyDates(state: ContestState, start: FormDataEntryValue | null, end: FormDataEntryValue | null): ContestState;
export const initialState: Readonly<ContestState>;
