import React, { forwardRef, memo } from "react";
import { X, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getFilterColor, getFilterIndex, parseLogLine } from "@/lib/utils";

interface FilterItem {
  id: string;
  type: "include" | "exclude";
  term: string;
  isRegex?: boolean;
}

interface LogEntry {
  lineNumber: number;
  timestamp: string;
  message: string;
}

interface ActiveFiltersProps {
  filters?: FilterItem[];
  entries?: string[];
  onRemoveFilter?: (id: string) => void;
  onToggleFilterType?: (id: string) => void;
  onClearAll?: () => void;
  filterLogic?: "AND" | "OR";
  onFilterLogicChange?: (logic: "AND" | "OR") => void;
  rightContent?: React.ReactNode;
}

const ButtonWithRef = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>((props, ref) => <Button ref={ref} {...props} />);

const DivWithRef = forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  (props, ref) => <div ref={ref} {...props} />,
);

interface FilterBadgeProps {
  filter: FilterItem;
  colorIndex: number;
  matchCount: number;
  percentage: string;
  onRemove: (id: string) => void;
  onToggleType: (id: string) => void;
}

// Memoized filter item to prevent unnecessary re-renders
const FilterBadge = memo<FilterBadgeProps>(
  ({ filter, colorIndex, matchCount, percentage, onRemove, onToggleType }) => {
    const colors = getFilterColor(filter.type, colorIndex);

    return (
      <TooltipProvider key={filter.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`inline-flex items-center ${colors.bg} ${colors.text} rounded-full text-sm font-semibold`}
            >
              <div
                className="px-3 py-1 cursor-pointer hover:underline"
                onClick={() => onToggleType(filter.id)}
              >
                {filter.type === "include" ? "+" : "-"}
                {filter.isRegex && <Code className="h-3 w-3 inline mr-1" />}
                {filter.term}
                <span className="ml-2">
                  ({matchCount.toLocaleString()} - {percentage}%)
                </span>
              </div>
              <div className="pr-3 pl-0">
                <X
                  size={14}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => onRemove(filter.id)}
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {filter.type === "include" ? "Include" : "Exclude"}: {filter.term}
              {filter.isRegex && <span className="ml-1">(Regex)</span>}
              <br />
              Matches {matchCount.toLocaleString()} lines ({percentage}%)
              <br />
              <span className="text-xs italic">
                Click to toggle filter type
              </span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);

const ActiveFilters = ({
  filters = [],
  entries = [],
  onRemoveFilter = () => {},
  onToggleFilterType = () => {},
  onClearAll = () => {},
  filterLogic = "OR",
  onFilterLogicChange = () => {},
  rightContent,
}: ActiveFiltersProps) => {
  // Process all entries for accurate filter stats
  const getFilterStats = (filter: FilterItem) => {
    if (entries.length === 0) return 0;

    // Process all entries for accurate counts
    const matchCount = entries.filter((entry) => {
      const { message } = parseLogLine(entry);

      // For log level terms, use more specific matching
      if (
        !filter.isRegex &&
        [
          "TRACE",
          "DEBUG",
          "INFO",
          "NOTICE",
          "WARN",
          "WARNING",
          "ERROR",
          "SEVERE",
          "CRITICAL",
          "FATAL",
          "ALERT",
          "EMERG",
          "EMERGENCY",
          "OTHER",
        ].includes(filter.term.toUpperCase())
      ) {
        const upperMessage = message.toUpperCase();
        const upperTerm = filter.term.toUpperCase();

        // Match exact log level patterns
        return (
          upperMessage.includes(`[${upperTerm}]`) ||
          upperMessage.includes(` ${upperTerm} `) ||
          upperMessage.startsWith(upperTerm + " ")
        );
      }

      // For regex filters
      if (filter.isRegex) {
        try {
          const regex = new RegExp(filter.term, "i");
          return regex.test(message);
        } catch (error) {
          console.error("Invalid regex pattern:", error);
          return false;
        }
      }

      // For other terms, use simple includes
      return message.toLowerCase().includes(filter.term.toLowerCase());
    }).length;

    return matchCount;
  };

  return (
    <div className="w-full bg-background border-b flex flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex-1 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const colorIndex = getFilterIndex(filters, filter.id);
            const matchCount = getFilterStats(filter);
            const percentage =
              entries.length > 0
                ? ((matchCount / entries.length) * 100).toFixed(1)
                : "0.0";

            return (
              <FilterBadge
                key={filter.id}
                filter={filter}
                colorIndex={colorIndex}
                matchCount={matchCount}
                percentage={percentage}
                onRemove={onRemoveFilter}
                onToggleType={onToggleFilterType}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-4">
          {filters.length > 1 && filters.some((f) => f.type === "include") && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-xs text-muted-foreground">Logic:</span>
              <div className="flex border rounded-md overflow-hidden">
                <button
                  className={`px-2 py-1 text-xs ${filterLogic === "OR" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  onClick={() => onFilterLogicChange("OR")}
                >
                  OR
                </button>
                <button
                  className={`px-2 py-1 text-xs ${filterLogic === "AND" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  onClick={() => onFilterLogicChange("AND")}
                >
                  AND
                </button>
              </div>
            </div>
          )}
          {filters.length > 0 && (
            <ButtonWithRef
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="shrink-0"
            >
              Clear All
            </ButtonWithRef>
          )}
          {rightContent}
        </div>
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(ActiveFilters);
