export type RoleTableColumnKey =
  | "role"
  | "entity"
  | "type"
  | "usage"
  | "rubric"
  | "jobDescription"
  | "actions";

type RoleTableAlignment = "left" | "center" | "right";

export const ROLE_TABLE_COLUMN_ALIGNMENTS: Record<RoleTableColumnKey, RoleTableAlignment> = {
  role: "left",
  entity: "left",
  type: "center",
  usage: "center",
  rubric: "center",
  jobDescription: "center",
  actions: "right",
};

export const ROLE_TABLE_ALIGNMENT_CLASSES: Record<RoleTableAlignment, string> = {
  left: "flex w-full items-center justify-start text-left",
  center: "flex w-full items-center justify-center text-center",
  right: "flex w-full items-center justify-end text-right",
};

export const ROLE_TABLE_CLIENT_COLUMNS: Record<
  RoleTableColumnKey,
  { width: string; horizontalPadding: string }
> = {
  role: { width: "w-[28%]", horizontalPadding: "px-6" },
  entity: { width: "w-[19%]", horizontalPadding: "px-4" },
  type: { width: "w-[12%]", horizontalPadding: "px-4" },
  usage: { width: "w-[17%]", horizontalPadding: "px-4" },
  rubric: { width: "w-[7%]", horizontalPadding: "px-4" },
  jobDescription: { width: "w-[7%]", horizontalPadding: "px-4" },
  actions: { width: "w-[10%]", horizontalPadding: "px-4 pr-6" },
};

export const ROLE_TABLE_ADMIN_GRID_TEMPLATE =
  "grid min-w-[1000px] grid-cols-[minmax(220px,1.5fr)_minmax(135px,1fr)_108px_90px_minmax(130px,.9fr)_80px_64px_56px_112px] items-center px-5";

export function roleTableAlignmentClass(column: RoleTableColumnKey): string {
  return ROLE_TABLE_ALIGNMENT_CLASSES[ROLE_TABLE_COLUMN_ALIGNMENTS[column]];
}
