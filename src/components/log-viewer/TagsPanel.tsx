import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tag, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TagsPanelProps {
  fileId: string;
  initialTags?: string[];
  onSaveTags: (tags: string[]) => void;
}

const TagsPanel = ({
  fileId,
  initialTags = [],
  onSaveTags,
}: TagsPanelProps) => {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Update tags when fileId or initialTags changes
  useEffect(() => {
    setTags(initialTags);
    setSaveStatus("idle");
  }, [fileId, initialTags]);

  const handleAddTag = () => {
    if (!newTag.trim()) return;

    // Don't add duplicate tags
    if (tags.includes(newTag.trim())) {
      setNewTag("");
      return;
    }

    const updatedTags = [...tags, newTag.trim()];
    setTags(updatedTags);
    setNewTag("");

    // Save tags when adding a new one
    saveTagsToDatabase(updatedTags);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(updatedTags);

    // Save tags when removing one
    saveTagsToDatabase(updatedTags);
  };

  const saveTagsToDatabase = (updatedTags: string[]) => {
    setSaveStatus("saving");

    try {
      onSaveTags(updatedTags);
      setSaveStatus("saved");

      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Error saving tags:", error);
      setSaveStatus("error");
    }
  };

  return (
    <Card className="shadow-none">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span>Tags</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white border border-blue-700 hover:bg-blue-700"
            >
              {tag}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => handleRemoveTag(tag)}
              />
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Add a tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTag();
            }}
            className="flex-1"
          />
          <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {saveStatus === "saved" && (
          <div className="text-xs text-green-500">Tags saved successfully</div>
        )}
        {saveStatus === "error" && (
          <div className="text-xs text-red-500">Error saving tags</div>
        )}
      </CardContent>
    </Card>
  );
};

export default TagsPanel;
