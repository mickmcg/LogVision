import React, { useRef, useEffect, useState, forwardRef } from "react";
import { getFilterColor, getFilterIndex } from "@/lib/utils";
import {
  Plus,
  Minus,
  WrapText,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LogEntry {
  lineNumber: number;
  timestamp: string;
  message: string;
}

interface FilterItem {
  id: string;
  type: "include" | "exclude";
  term: string;
}

interface LogDisplayProps {
  entries?: LogEntry[];
  filters?: FilterItem[];
  searchTerm?: string;
  className?: string;
  onAddInclude?: (term: string) => void;
  onAddExclude?: (term: string) => void;
}

const DEFAULT_ENTRIES: LogEntry[] = [
  {
    lineNumber: 1,
    timestamp: "25-Dec-2024 00:00:06.596",
    message: "[INFO] Application started successfully",
  },
  {
    lineNumber: 2,
    timestamp: "25-Dec-2024 00:00:06.596",
    message: "[DEBUG] Initializing core components",
  },
];

const MIN_ROW_HEIGHT = 48;
const LINE_HEIGHT = 28;
const BASE_PADDING = 16;
const EXTRA_PADDING = 8;
const CHAR_PER_LINE = 120;
const TIMESTAMP_WIDTH = 200;

const ButtonWithRef = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>((props, ref) => <Button ref={ref} {...props} />);

const LogDisplay = ({
  entries = DEFAULT_ENTRIES,
  filters = [],
  searchTerm = "",
  className = "",
  onAddInclude = () => {},
  onAddExclude = () => {},
}: LogDisplayProps) => {
  const [wrapText, setWrapText] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selection: string;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

  const getHighlights = (message: string) => {
    const matches = [];

    filters.forEach((filter) => {
      const term = filter.term.toLowerCase();
      const messageLower = message.toLowerCase();
      let index = messageLower.indexOf(term);

      while (index !== -1) {
        const colorIndex = getFilterIndex(filters, filter.id);
        const colors = getFilterColor(filter.type, colorIndex);
        matches.push({
          start: index,
          end: index + term.length,
          term: message.slice(index, index + term.length),
          colors,
        });
        index = messageLower.indexOf(term, index + 1);
      }
    });
    return matches.sort((a, b) => a.start - b.start);
  };

  const isVisible = (message: string) => {
    const excludeFilters = filters.filter((f) => f.type === "exclude");
    const includeFilters = filters.filter((f) => f.type === "include");

    if (excludeFilters.length > 0) {
      const shouldExclude = excludeFilters.some((filter) =>
        message.toLowerCase().includes(filter.term.toLowerCase()),
      );
      if (shouldExclude) return false;
    }

    if (includeFilters.length > 0) {
      return includeFilters.some((filter) =>
        message.toLowerCase().includes(filter.term.toLowerCase()),
      );
    }

    return true;
  };

  const highlightText = (text: string) => {
    const highlights = getHighlights(text);
    if (highlights.length === 0) {
      if (!searchTerm) return text;

      const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));
      return parts.map((part, i) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <span key={i} className="bg-yellow-100 text-yellow-700 font-medium">
            {part}
          </span>
        ) : (
          part
        ),
      );
    }

    let lastIndex = 0;
    const result = [];

    highlights.forEach((highlight, index) => {
      if (highlight.start > lastIndex) {
        result.push(text.slice(lastIndex, highlight.start));
      }
      result.push(
        <span
          key={index}
          className={`${highlight.colors.highlight} font-medium`}
        >
          {highlight.term}
        </span>,
      );
      lastIndex = highlight.end;
    });

    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result;
  };

  const visibleEntries = entries.filter((entry) => isVisible(entry.message));

  return (
    <div
      ref={containerRef}
      className={`bg-background h-full w-full border rounded-md ${className}`}
      tabIndex={0}
    >
      <div className="h-full w-full font-mono text-sm">
        <div className="flex gap-4 py-2 px-4 border-b bg-muted/50 font-semibold sticky top-0 z-10">
          <span className="w-12 text-right text-muted-foreground shrink-0">
            Line #
          </span>
          <span
            className={`w-[${TIMESTAMP_WIDTH}px] text-muted-foreground shrink-0`}
          >
            Timestamp
          </span>
          <div className="flex-1 flex justify-between items-center">
            <span className="text-muted-foreground">Event Detail</span>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonWithRef
                      variant="ghost"
                      size="sm"
                      onClick={() => setWrapText(!wrapText)}
                      className={
                        wrapText ? "text-primary" : "text-muted-foreground"
                      }
                    >
                      <WrapText className="h-4 w-4" />
                    </ButtonWithRef>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle text wrapping (Alt+W)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        <div className="overflow-auto" style={{ height: "calc(100% - 40px)" }}>
          <div className={wrapText ? "" : "min-w-[1200px] w-full"}>
            {visibleEntries.map((entry, index) => (
              <div
                key={entry.lineNumber}
                className={`flex gap-4 py-3 px-4 ${index % 2 === 0 ? "bg-muted/50" : "bg-background"}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const selection = window.getSelection()?.toString();
                  if (selection) {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      selection,
                    });
                  }
                }}
              >
                <span className="w-12 text-right text-muted-foreground shrink-0">
                  {entry.lineNumber}
                </span>
                <span
                  className={`w-[${TIMESTAMP_WIDTH}px] text-muted-foreground shrink-0 font-mono`}
                >
                  {entry.timestamp}
                </span>
                <span
                  className={`flex-1 font-mono select-text ${wrapText ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}
                >
                  {highlightText(entry.message)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {contextMenu && (
        <div
          className="fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="bg-popover text-popover-foreground rounded-md border shadow-md p-1 min-w-[8rem] flex flex-col">
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                onAddInclude(contextMenu.selection);
                setContextMenu(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Include Filter
            </button>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                onAddExclude(contextMenu.selection);
                setContextMenu(null);
              }}
            >
              <Minus className="h-4 w-4" />
              Add Exclude Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogDisplay;
