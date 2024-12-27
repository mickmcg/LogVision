import React, { forwardRef } from "react";
import { X } from "lucide-react";
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
  onClearAll?: () => void;
  rightContent?: React.ReactNode;
}

const ButtonWithRef = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>((props, ref) => <Button ref={ref} {...props} />);

const DivWithRef = forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  (props, ref) => <div ref={ref} {...props} />,
);

const ActiveFilters = ({
  filters = [],
  entries = [],
  onRemoveFilter = () => {},
  onClearAll = () => {},
  rightContent,
}: ActiveFiltersProps) => {
  const getFilterStats = (filter: FilterItem) => {
    const matchCount = entries.filter((entry) => {
      const { message } = parseLogLine(entry);
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
            const colors = getFilterColor(filter.type, colorIndex);
            const matchCount = getFilterStats(filter);
            const percentage = ((matchCount / entries.length) * 100).toFixed(1);

            return (
              <TooltipProvider key={filter.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`inline-flex items-center ${colors.bg} ${colors.text} rounded-full text-sm font-semibold`}
                    >
                      <div className="px-3 py-1">
                        {filter.type === "include" ? "+" : "-"}
                        {filter.term}
                        <span className="ml-2">
                          ({matchCount.toLocaleString()} - {percentage}%)
                        </span>
                      </div>
                      <div className="pr-3 pl-0">
                        <X
                          size={14}
                          className="cursor-pointer hover:opacity-80"
                          onClick={() => onRemoveFilter(filter.id)}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {filter.type === "include" ? "Include" : "Exclude"}:{" "}
                      {filter.term}
                      <br />
                      Matches {matchCount.toLocaleString()} lines ({percentage}
                      %)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-4">
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

export default ActiveFilters;
