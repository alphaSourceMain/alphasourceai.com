import { useLayoutEffect, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useAppearance } from "@/context/AppearanceContext";
import { holdGa4ForDocument } from "@/lib/ga4";

/** Presentation only. Authentication and recovery stay in their existing owners. */
export default function PublicSignInPanel({ open, onOpenChange, title, description, children, returnFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string;
  description: string; children: ReactNode; returnFocus?: () => void;
}) {
  const { resolvedMode } = useAppearance();
  // Presentation-only privacy boundary; authentication owners and handlers stay unchanged.
  useLayoutEffect(() => { if (open) holdGa4ForDocument(); }, [open]);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[110] bg-[#050a1f]/75 backdrop-blur-sm" />
      <Dialog.Content className="b1-public-scope b1-auth-dialog" data-theme={resolvedMode}
        onCloseAutoFocus={returnFocus ? event => { event.preventDefault(); returnFocus(); } : undefined}>
        <Dialog.Title className="b1-auth-title">{title}</Dialog.Title>
        <Dialog.Description className="b1-auth-description">{description}</Dialog.Description>
        {children}
        <Dialog.Close aria-label="Close sign in" className="b1-auth-close"><X size={20} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
