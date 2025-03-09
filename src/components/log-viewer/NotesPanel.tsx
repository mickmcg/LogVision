import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StickyNote, Save } from "lucide-react";

interface NotesPanelProps {
  fileId: string;
  onSaveNotes: (notes: string) => void;
  initialNotes?: string;
}

const NotesPanel = ({
  fileId,
  onSaveNotes,
  initialNotes = "",
}: NotesPanelProps) => {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Update notes when fileId or initialNotes changes
  useEffect(() => {
    setNotes(initialNotes);
    setSaveStatus("idle");
  }, [fileId, initialNotes]);

  const handleSave = () => {
    setSaveStatus("saving");
    setIsSaving(true);

    try {
      onSaveNotes(notes);
      setSaveStatus("saved");

      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Error saving notes:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-none">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            <span>Notes</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>

        <Textarea
          placeholder="Add notes about this log file..."
          className="min-h-[100px] text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {saveStatus === "saved" && (
          <div className="text-xs text-green-500">Notes saved successfully</div>
        )}
        {saveStatus === "error" && (
          <div className="text-xs text-red-500">Error saving notes</div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotesPanel;
