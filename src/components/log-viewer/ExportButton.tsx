import React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExportButtonProps {
  fileName: string;
  content: string[];
  disabled?: boolean;
}

const ExportButton = ({
  fileName,
  content,
  disabled = false,
}: ExportButtonProps) => {
  const handleExport = () => {
    if (content.length === 0) return;

    // Create a blob with the filtered content
    const blob = new Blob([content.join("\n")], { type: "text/plain" });

    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Generate a filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .substring(0, 19);
    const exportFileName = `${fileName.replace(/\.[^\.]+$/, "")}_filtered_${timestamp}.log`;

    link.setAttribute("download", exportFileName);
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={disabled || content.length === 0}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export filtered log file</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ExportButton;
