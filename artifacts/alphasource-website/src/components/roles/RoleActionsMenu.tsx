import { ChevronDown, Copy, FileText, RefreshCw, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  replacementBlockerDescription,
  type RoleJdReplacementEligibility,
} from "@/lib/roleJdReplacementEligibility";

export default function RoleActionsMenu({
  open,
  onOpenChange,
  roleTitle,
  canManageRole,
  canCopyInterviewLink,
  copyDisabledReason,
  hasJobDescription,
  hasRubric,
  openingJobDescription,
  loadingRubric,
  replacementEligibility,
  updatingStatus,
  deleting,
  isInactive,
  onTriggerFocus,
  onCopyInterviewLink,
  onViewJobDescription,
  onViewRubric,
  onReplaceJobDescription,
  onToggleRoleStatus,
  onDeleteRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleTitle: string;
  canManageRole: boolean;
  canCopyInterviewLink: boolean;
  copyDisabledReason?: string;
  hasJobDescription: boolean;
  hasRubric: boolean;
  openingJobDescription: boolean;
  loadingRubric: boolean;
  replacementEligibility: RoleJdReplacementEligibility;
  updatingStatus: boolean;
  deleting: boolean;
  isInactive: boolean;
  onTriggerFocus?: (trigger: HTMLButtonElement) => void;
  onCopyInterviewLink: () => void;
  onViewJobDescription: () => void;
  onViewRubric: () => void;
  onReplaceJobDescription: () => void;
  onToggleRoleStatus: () => void;
  onDeleteRole: () => void;
}) {
  const replacementUnavailable = !replacementEligibility.eligible;
  const replacementReason = replacementBlockerDescription(replacementEligibility);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => onTriggerFocus?.(event.currentTarget)}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-[#A380F6]/60 hover:text-[#7C5FCC] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/35"
          style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
          aria-label={`Actions for ${roleTitle}`}
        >
          Actions
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className="z-[95] w-64 rounded-md border p-1.5"
        style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text)" }}
      >
        <DropdownMenuItem
          disabled={!canCopyInterviewLink}
          onSelect={onCopyInterviewLink}
          className="gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
        >
          <Copy className="h-4 w-4 text-[#A380F6]" />
          <span>Copy interview link</span>
        </DropdownMenuItem>
        {!canCopyInterviewLink && copyDisabledReason && (
          <p className="px-2.5 pb-1.5 text-[11px] leading-4" style={{ color: "var(--as-text-subtle)" }}>
            {copyDisabledReason}
          </p>
        )}
        <DropdownMenuItem
          disabled={!hasJobDescription || openingJobDescription}
          onSelect={onViewJobDescription}
          className="gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
        >
          <FileText className="h-4 w-4 text-[#A380F6]" />
          <span>{openingJobDescription ? "Opening job description..." : "View job description"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasRubric || loadingRubric}
          onSelect={onViewRubric}
          className="gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
        >
          <FileText className="h-4 w-4 text-[#A380F6]" />
          <span>{loadingRubric ? "Loading rubric..." : "View rubric"}</span>
        </DropdownMenuItem>

        {canManageRole && (
          <>
            <DropdownMenuSeparator style={{ backgroundColor: "var(--as-border)" }} />
            <DropdownMenuItem
              disabled={replacementUnavailable}
              onSelect={() => {
                if (replacementEligibility.eligible) onReplaceJobDescription();
              }}
              className="gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
            >
              <RefreshCw className="h-4 w-4 text-[#A380F6]" />
              <span>Replace job description</span>
            </DropdownMenuItem>
            {replacementUnavailable && (
              <div className="px-2.5 pb-2 text-[11px] leading-4" style={{ color: "var(--as-text-subtle)" }}>
                <p>Unavailable after candidate or interview activity starts.</p>
                <p>{replacementReason}</p>
              </div>
            )}
            <DropdownMenuItem
              disabled={updatingStatus}
              onSelect={onToggleRoleStatus}
              className="gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
            >
              <RefreshCw className="h-4 w-4 text-[#A380F6]" />
              <span>{isInactive ? "Reopen role" : "Close role"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ backgroundColor: "var(--as-border)" }} />
            <DropdownMenuItem
              disabled={deleting}
              onSelect={onDeleteRole}
              className="gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold text-red-600 focus:bg-red-50 focus:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete role</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
