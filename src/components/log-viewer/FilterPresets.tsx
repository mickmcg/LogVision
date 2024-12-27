import React, { forwardRef } from "react";
import { Save, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface FilterPreset {
  id: string;
  name: string;
  filters: Array<{
    id: string;
    type: "include" | "exclude";
    term: string;
  }>;
}

interface FilterPresetsProps {
  currentFilters: FilterPreset["filters"];
  presets: FilterPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: FilterPreset) => void;
  onDeletePreset: (presetId: string) => void;
}

const ButtonWithRef = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>((props, ref) => <Button ref={ref} {...props} />);

export const FilterPresets = ({
  currentFilters,
  presets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: FilterPresetsProps) => {
  const [newPresetName, setNewPresetName] = React.useState("");
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = React.useState(false);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    onSavePreset(newPresetName.trim());
    setNewPresetName("");
    setSaveDialogOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <ButtonWithRef
                  variant="outline"
                  size="icon"
                  disabled={currentFilters.length === 0}
                >
                  <Save className="h-4 w-4" />
                </ButtonWithRef>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Save current filters as preset</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Save your current filter configuration as a preset for quick
              access later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Preset name"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
              }}
            />
            <Button onClick={handleSavePreset} disabled={!newPresetName.trim()}>
              Save Preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <ButtonWithRef
                  variant="outline"
                  size="icon"
                  disabled={presets.length === 0}
                >
                  <FolderOpen className="h-4 w-4" />
                </ButtonWithRef>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Load filter preset</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Filter Preset</DialogTitle>
            <DialogDescription>
              Choose a previously saved filter preset to apply to your current
              view.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{preset.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {preset.filters.length} filter
                    {preset.filters.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ButtonWithRef
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onLoadPreset(preset);
                      setLoadDialogOpen(false);
                    }}
                  >
                    Load
                  </ButtonWithRef>
                  <ButtonWithRef
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeletePreset(preset.id)}
                  >
                    <X className="h-4 w-4" />
                  </ButtonWithRef>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
