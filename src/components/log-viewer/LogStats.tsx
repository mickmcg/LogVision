import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Clock, Layers } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseTimestamp } from "@/lib/utils";

interface LogEntry {
  lineNumber: number;
  timestamp: string;
  message: string;
}

interface LogStatsProps {
  entries: LogEntry[];
  allEntries?: LogEntry[];
  onToggle?: () => void;
  showStats?: boolean;
  showHourlyActivity?: boolean;
  onAddFilter?: (term: string, type?: "include" | "exclude") => void;
}

const LogStats = (props: LogStatsProps) => {
  const {
    entries,
    onToggle,
    showStats = true,
    showHourlyActivity = true,
    onAddFilter,
  } = props;
  const [showStacked, setShowStacked] = useState(false);
  const [showLevels, setShowLevels] = useState(true);

  const stats = useMemo(() => {
    const levels = new Map<string, number>();
    const hourlyByLevel: { [hour: number]: { [level: string]: number } } = {};
    let errorCount = 0;
    let warningCount = 0;

    // Initialize hourly data for all 24 hours
    for (let i = 0; i < 24; i++) {
      hourlyByLevel[i] = {};
    }

    // Use the full dataset instead of just the first 5000 entries
    const allEntries = entries;

    allEntries.forEach((entry) => {
      // Extract log level
      const levelMatch =
        entry.message.match(
          /\[(TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY)\]/i,
        ) ||
        entry.message.match(
          /\s(TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY)\s/i,
        ) ||
        entry.message.match(
          /^(TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|SEVERE|CRITICAL|FATAL|ALERT|EMERG|EMERGENCY)\s/i,
        );

      const level = levelMatch
        ? levelMatch[1].toUpperCase() === "WARNING"
          ? "WARN"
          : levelMatch[1].toUpperCase() === "EMERGENCY"
            ? "EMERG"
            : levelMatch[1].toUpperCase()
        : "OTHER";
      levels.set(level, (levels.get(level) || 0) + 1);
      if (level === "ERROR") errorCount++;
      if (level === "WARN") warningCount++;

      // Track hourly distribution by level
      const parsedDate = parseTimestamp(entry.timestamp);
      if (parsedDate) {
        const hour = parsedDate.getHours();
        hourlyByLevel[hour][level] = (hourlyByLevel[hour][level] || 0) + 1;
      }
    });

    return {
      levels: Object.fromEntries(levels),
      errorRate: (errorCount / entries.length) * 100,
      warningRate: (warningCount / entries.length) * 100,
      totalEntries: entries.length,
      hourlyByLevel,
    };
  }, [entries]);

  const levelColors = {
    INFO: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-200",
      bar: "bg-blue-400",
    },
    ERROR: {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-200",
      bar: "bg-red-400",
    },
    SEVERE: {
      bg: "bg-rose-100",
      text: "text-rose-800",
      border: "border-rose-200",
      bar: "bg-rose-400",
    },
    WARN: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      border: "border-yellow-200",
      bar: "bg-yellow-400",
    },
    DEBUG: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      bar: "bg-green-400",
    },
    OTHER: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      border: "border-gray-200",
      bar: "bg-gray-400",
    },
  };

  const getMaxHourlyCount = () => {
    if (!showStacked) {
      return Math.max(
        1,
        ...Object.values(stats.hourlyByLevel).map((levels) =>
          Object.values(levels).reduce((sum, count) => sum + count, 0),
        ),
      );
    }
    return Math.max(
      1,
      ...Object.values(stats.hourlyByLevel).map((levels) =>
        Object.values(levels).reduce((sum, count) => sum + count, 0),
      ),
    );
  };

  return (
    <div className="relative h-[830px]">
      {entries.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <div className="text-sm text-muted-foreground">
            No data in selected range
          </div>
        </div>
      )}
      {!showStats && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10"
          onClick={onToggle}
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
            className="lucide lucide-chevron-right"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Button>
      )}
      <ScrollArea className="h-full bg-muted/10">
        <div className="p-3 space-y-3">
          <Card className="shadow-none">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  <span>Log Levels</span>
                </div>
                <div className="flex items-center gap-1">
                  {onToggle && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={onToggle}
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
                        className="lucide lucide-chevron-left"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
              {showLevels && (
                <div className="flex flex-col gap-1.5">
                  {Object.entries(stats.levels).map(([level, count]) => (
                    <div
                      key={level}
                      className="flex items-center justify-between text-sm"
                    >
                      <Badge
                        variant="outline"
                        className={`${levelColors[level]?.bg || levelColors.OTHER.bg} ${levelColors[level]?.text || levelColors.OTHER.text} border ${levelColors[level]?.border || levelColors.OTHER.border} cursor-pointer hover:ring-1 hover:ring-offset-1`}
                        onClick={() => {
                          if (level === "OTHER") {
                            // For OTHER, add exclude filters for all standard log levels
                            const standardLevels = [
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
                            ];
                            standardLevels.forEach((lvl) =>
                              props.onAddFilter?.(lvl, "exclude"),
                            );
                          } else {
                            props.onAddFilter?.(level, "include");
                          }
                        }}
                      >
                        {level}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{count}</span>
                        <span className="text-xs text-muted-foreground">
                          ({((count / stats.totalEntries) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {showHourlyActivity && (
            <Card className="shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Activity by Hour</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={
                            showStacked
                              ? "text-primary"
                              : "text-muted-foreground"
                          }
                          onClick={() => setShowStacked(!showStacked)}
                        >
                          <Layers className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {showStacked
                            ? "Show simple view"
                            : "Show stacked by level"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="grid grid-cols-12 gap-1 text-center">
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const hourData = stats.hourlyByLevel[hour] || {};
                    const maxCount = getMaxHourlyCount();
                    const totalCount = Object.values(hourData).reduce(
                      (sum, count) => sum + count,
                      0,
                    );

                    return (
                      <TooltipProvider key={hour}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-center">
                              <div className="w-full relative h-[40px] flex items-end">
                                {showStacked ? (
                                  <div className="w-full flex flex-col-reverse">
                                    {Object.entries(stats.levels).map(
                                      ([level]) => {
                                        const count = hourData[level] || 0;
                                        const height =
                                          maxCount > 0
                                            ? (count / maxCount) * 40
                                            : 0;
                                        return (
                                          <div
                                            key={level}
                                            className={`w-full ${levelColors[level]?.bar || levelColors.OTHER.bar}`}
                                            style={{ height: `${height}px` }}
                                          />
                                        );
                                      },
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    className="w-full bg-blue-100 rounded-sm"
                                    style={{
                                      height: `${maxCount > 0 ? (totalCount / maxCount) * 40 : 0}px`,
                                    }}
                                  />
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {hour}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              <div className="font-semibold mb-1">
                                Hour {hour}:00
                              </div>
                              {Object.entries(hourData).map(
                                ([level, count]) => (
                                  <div
                                    key={level}
                                    className="flex items-center gap-2"
                                  >
                                    <Badge
                                      variant="outline"
                                      className={`${levelColors[level]?.bg || levelColors.OTHER.bg} ${levelColors[level]?.text || levelColors.OTHER.text} border ${levelColors[level]?.border || levelColors.OTHER.border}`}
                                    >
                                      {level}
                                    </Badge>
                                    <span>{count}</span>
                                  </div>
                                ),
                              )}
                              <div className="mt-1 pt-1 border-t">
                                Total: {totalCount}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LogStats;
