"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterFields } from "@/components/filter-fields";
import type { AnalysisFilters } from "@luxalgo/journal-core";

interface CohortFilterDialogProps {
  open: boolean;
  editingGroup: "a" | "b" | null;
  draft: AnalysisFilters;
  onDraftChange: (draft: AnalysisFilters) => void;
  onClose: () => void;
  onApply: () => void;
}

export function CohortFilterDialog({
  open,
  editingGroup,
  draft,
  onDraftChange,
  onClose,
  onApply,
}: CohortFilterDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span>Configure Group {editingGroup?.toUpperCase()} Filters</span>
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <FilterFields value={draft} onChange={onDraftChange} />
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" size="sm" onClick={() => onDraftChange({})}>
            Clear all
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={onApply}>
              Apply to group
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
