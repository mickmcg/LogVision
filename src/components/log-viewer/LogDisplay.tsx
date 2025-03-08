import React, { useRef, useEffect, useState, forwardRef, memo } from "react";
import { getFilterColor, getFilterIndex, parseTimestamp } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";

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
  timeRange?: { startDate?: Date; endDate?: Date };
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
const PAGE_SIZE = 100;

const ButtonWithRef = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>((props, ref) => <Button ref={ref} {...props} />);

interface LogEntryRowProps {
  entry: LogEntry;
  index: number;
  wrapText: boolean;
  highlightText: (text: string) => React.ReactNode;
  onContextMenu: (e: React.MouseEvent) => void;
}

// Memoized log entry component for better performance
const LogEntryRow = memo<LogEntryRowProps>(
  ({ entry, index, wrapText, highlightText, onContextMenu }) => {
    return (
      <div
        className={`flex gap-4 py-3 px-4 ${index % 2 === 0 ? "bg-muted/50" : "bg-background"}`}
        onContextMenu={onContextMenu}
      >
        <span className="w-12 text-right text-muted-foreground shrink-0">
          {entry.lineNumber}
        </span>
        <span className="w-[200px] text-muted-foreground shrink-0 font-mono">
          {entry.timestamp}
        </span>
        <span
          className={`flex-1 font-mono select-text ${wrapText ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}
        >
          {highlightText(entry.message)}
        </span>
      </div>
    );
  },
);

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selection: string;
  } | null>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 });
  const [scrolling, setScrolling] = useState(false);

  // Handle context menu closing
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

  // Handle virtual scrolling with optimizations
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current || entries.length === 0) return;

      const { scrollTop, clientHeight, scrollHeight } =
        scrollContainerRef.current;
      const buffer = entries.length > 50000 ? 10 : 20; // Smaller buffer for very large datasets

      // Calculate visible range based on scroll position
      const itemHeight = 40; // Approximate height of each log entry
      const startIndex = Math.max(
        0,
        Math.floor(scrollTop / itemHeight) - buffer,
      );
      const visibleItems = Math.ceil(clientHeight / itemHeight) + buffer * 2;
      const endIndex = Math.min(entries.length, startIndex + visibleItems);

      // Only update state if the range has changed significantly (at least 5 items)
      if (
        Math.abs(startIndex - visibleRange.start) > 5 ||
        Math.abs(endIndex - visibleRange.end) > 5
      ) {
        setVisibleRange({ start: startIndex, end: endIndex });
      }
    };

    // Use throttled scroll handler for better performance
    let scrollTimeout: number | null = null;
    const throttledScrollHandler = () => {
      if (scrollTimeout === null) {
        scrollTimeout = window.setTimeout(() => {
          handleScroll();
          scrollTimeout = null;
        }, 16); // ~60fps
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", throttledScrollHandler);
      handleScroll(); // Initial calculation
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", throttledScrollHandler);
      }
      if (scrollTimeout !== null) {
        window.clearTimeout(scrollTimeout);
      }
    };
  }, [entries.length, visibleRange.start, visibleRange.end]);

  const getHighlights = (message: string) => {
    // Skip processing if no filters
    if (filters.length === 0) return [];

    const matches = [];
    const messageLower = message.toLowerCase();

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const term = filter.term.toLowerCase();

      // Skip empty terms
      if (!term) continue;

      // Use a more efficient approach for finding all occurrences
      let index = messageLower.indexOf(term);
      if (index === -1) continue; // Skip if no match at all

      const colorIndex = getFilterIndex(filters, filter.id);
      const colors = getFilterColor(filter.type, colorIndex);

      while (index !== -1) {
        matches.push({
          start: index,
          end: index + term.length,
          term: message.slice(index, index + term.length),
          colors,
        });
        index = messageLower.indexOf(term, index + term.length);
      }
    }

    // Only sort if we have multiple matches
    return matches.length > 1
      ? matches.sort((a, b) => a.start - b.start)
      : matches;
  };

  // Memoize the highlight function for better performance
  const highlightText = React.useMemo(() => {
    // Return a function that does the actual highlighting
    return (text: string) => {
      // Quick return for empty text
      if (!text) return text;

      // Skip processing if no filters and no search term
      if (filters.length === 0 && !searchTerm) return text;

      const highlights = getHighlights(text);
      if (highlights.length === 0) {
        if (!searchTerm) return text;

        // Optimize search term highlighting
        if (searchTerm.length < 2) return text; // Skip very short search terms

        try {
          const searchRegex = new RegExp(
            `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
            "gi",
          );
          const parts = text.split(searchRegex);
          return parts.map((part, i) =>
            part.toLowerCase() === searchTerm.toLowerCase() ? (
              <span
                key={i}
                className="bg-yellow-100 text-yellow-700 font-medium"
              >
                {part}
              </span>
            ) : (
              part
            ),
          );
        } catch (e) {
          // Fallback if regex fails
          return text;
        }
      }

      // Optimize highlight rendering for large text
      let lastIndex = 0;
      const result = [];
      const maxHighlights = 50; // Limit number of highlights for very long messages
      const highlightsToProcess =
        highlights.length > maxHighlights
          ? highlights.slice(0, maxHighlights)
          : highlights;

      for (let i = 0; i < highlightsToProcess.length; i++) {
        const highlight = highlightsToProcess[i];
        if (highlight.start > lastIndex) {
          result.push(text.slice(lastIndex, highlight.start));
        }
        result.push(
          <span key={i} className={`${highlight.colors.highlight} font-medium`}>
            {highlight.term}
          </span>,
        );
        lastIndex = highlight.end;
      }

      if (lastIndex < text.length) {
        // For very long text, truncate the end if needed
        const remainingText = text.slice(lastIndex);
        result.push(
          remainingText.length > 10000
            ? remainingText.substring(0, 10000) + "..."
            : remainingText,
        );
      }

      return result;
    };
  }, [filters, searchTerm]);

  const handleContextMenu = (e: React.MouseEvent, entry: LogEntry) => {
    e.preventDefault();
    const selection = window.getSelection()?.toString();
    if (selection) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        selection,
      });
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      setScrolling(true);
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      setTimeout(() => setScrolling(false), 500);
    }
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      setScrolling(true);
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
      setTimeout(() => setScrolling(false), 500);
    }
  };

  const scrollPageUp = () => {
    if (scrollContainerRef.current) {
      setScrolling(true);
      const currentScroll = scrollContainerRef.current.scrollTop;
      const pageHeight = scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, currentScroll - pageHeight),
        behavior: "smooth",
      });
      setTimeout(() => setScrolling(false), 500);
    }
  };

  const scrollPageDown = () => {
    if (scrollContainerRef.current) {
      setScrolling(true);
      const currentScroll = scrollContainerRef.current.scrollTop;
      const pageHeight = scrollContainerRef.current.clientHeight;
      const maxScroll = scrollContainerRef.current.scrollHeight - pageHeight;
      scrollContainerRef.current.scrollTo({
        top: Math.min(maxScroll, currentScroll + pageHeight),
        behavior: "smooth",
      });
      setTimeout(() => setScrolling(false), 500);
    }
  };

  // Only render visible entries for better performance
  const visibleEntries = entries.slice(visibleRange.start, visibleRange.end);

  // Calculate total height to maintain proper scrollbar
  const totalHeight = entries.length * 40; // Approximate height of each entry
  const topPadding = visibleRange.start * 40;

  return (
    <div
      ref={containerRef}
      className={`bg-background h-[830px] w-full border rounded-md ${className}`}
      tabIndex={0}
    >
      <div className="h-full w-full font-mono text-sm flex flex-col">
        <div className="flex gap-4 py-2 px-4 border-b bg-muted/50 font-semibold sticky top-0 z-20">
          <span className="w-12 text-right text-muted-foreground shrink-0">
            Line #
          </span>
          <span className="w-[200px] text-muted-foreground shrink-0">
            Timestamp
          </span>
          <div className="flex-1 flex justify-between items-center">
            <span className="text-muted-foreground">Event Detail</span>
            <div className="flex items-center gap-2">
              {/* Scroll Controls */}
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ButtonWithRef
                        variant="ghost"
                        size="icon"
                        onClick={scrollToTop}
                        className="h-8 w-8"
                        disabled={scrolling}
                      >
                        <ChevronsUp className="h-4 w-4" />
                      </ButtonWithRef>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jump to top</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ButtonWithRef
                        variant="ghost"
                        size="icon"
                        onClick={scrollPageUp}
                        className="h-8 w-8"
                        disabled={scrolling}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </ButtonWithRef>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Page up</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ButtonWithRef
                        variant="ghost"
                        size="icon"
                        onClick={scrollPageDown}
                        className="h-8 w-8"
                        disabled={scrolling}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </ButtonWithRef>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Page down</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ButtonWithRef
                        variant="ghost"
                        size="icon"
                        onClick={scrollToBottom}
                        className="h-8 w-8"
                        disabled={scrolling}
                      >
                        <ChevronsDown className="h-4 w-4" />
                      </ButtonWithRef>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Jump to bottom</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Separator orientation="vertical" className="h-4" />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ButtonWithRef
                      variant="ghost"
                      size="icon"
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
        <div
          ref={scrollContainerRef}
          className="h-[calc(100%-48px)] overflow-auto"
        >
          <div
            className={wrapText ? "" : "min-w-[1200px] w-full"}
            style={{ height: `${totalHeight}px`, position: "relative" }}
          >
            <div
              style={{
                position: "absolute",
                top: `${topPadding}px`,
                width: "100%",
              }}
            >
              {visibleEntries.map((entry, index) => (
                <LogEntryRow
                  key={entry.lineNumber}
                  entry={entry}
                  index={index + visibleRange.start}
                  wrapText={wrapText}
                  highlightText={highlightText}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                />
              ))}
            </div>
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
            <div className="border-t my-1"></div>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                window.open(
                  `https://www.google.com/search?q=${encodeURIComponent(contextMenu.selection)}`,
                  "_blank",
                );
                setContextMenu(null);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-search"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Search on Google
            </button>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                window.open(
                  `https://www.bing.com/search?q=${encodeURIComponent(contextMenu.selection)}`,
                  "_blank",
                );
                setContextMenu(null);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-search"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Search in Bing
            </button>
            <button
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground gap-2"
              onClick={() => {
                window.open(
                  `https://www.ecosia.org/search?q=${encodeURIComponent(contextMenu.selection)}`,
                  "_blank",
                );
                setContextMenu(null);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-leaf"
              >
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
              Search in Ecosia
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogDisplay;
