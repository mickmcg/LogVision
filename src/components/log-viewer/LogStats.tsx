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

interface LogEntry {
  lineNumber: number;
  timestamp: string;
  message: string;
}

interface LogStatsProps {
  entries: LogEntry[];
  onToggle?: () => void;
  showStats?: boolean;
}

const LogStats = ({ entries, onToggle, showStats = true }: LogStatsProps) => {
  const [showStacked, setShowStacked] = useState(false);

  const stats = useMemo(() => {
    const levels = new Map<string, number>();
    const hourlyByLevel = new Map<number, Map<string, number>>();
    let errorCount = 0;
    let warningCount = 0;

    entries.forEach((entry) => {
      // Extract log level
      const levelMatch = entry.message.match(/\s(INFO|ERROR|WARN|DEBUG)\s/i);
      if (levelMatch) {
        const level = levelMatch[1].toUpperCase();
        levels.set(level, (levels.get(level) || 0) + 1);
        if (level === "ERROR") errorCount++;
        if (level === "WARN") warningCount++;

        // Track hourly distribution by level
        try {
          const hour = new Date(entry.timestamp).getHours();
          if (!hourlyByLevel.has(hour)) {
            hourlyByLevel.set(hour, new Map());
          }
          const levelCounts = hourlyByLevel.get(hour)!;
          levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
        } catch {}
      }
    });

    return {
      levels: Object.fromEntries(levels),
      errorRate: (errorCount / entries.length) * 100,
      warningRate: (warningCount / entries.length) * 100,
      totalEntries: entries.length,
      hourlyByLevel: Object.fromEntries(
        Array.from(hourlyByLevel.entries()).map(([hour, levels]) => [
          hour,
          Object.fromEntries(levels),
        ]),
      ),
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
  };

  const getMaxHourlyCount = () => {
    if (!showStacked) {
      return Math.max(
        ...Object.values(stats.hourlyByLevel).map((levels) =>
          Object.values(levels).reduce((sum, count) => sum + count, 0),
        ),
      );
    }
    return Math.max(
      ...Object.values(stats.hourlyByLevel).map((levels) =>
        Object.values(levels).reduce((sum, count) => sum + count, 0),
      ),
    );
  };

  return (
    <ScrollArea className="h-[830px] bg-muted/10">
      <div className="p-3 space-y-3">
        <Card className="shadow-none">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <BarChart className="h-4 w-4" />
              <span>Log Levels</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(stats.levels).map(([level, count]) => (
                <div
                  key={level}
                  className="flex items-center justify-between text-sm"
                >
                  <Badge
                    variant="outline"
                    className={`${levelColors[level].bg} ${levelColors[level].text} border ${levelColors[level].border}`}
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
          </CardContent>
        </Card>

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
                        showStacked ? "text-primary" : "text-muted-foreground"
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
                                {Object.entries(levelColors).map(
                                  ([level, colors]) => {
                                    const count = hourData[level] || 0;
                                    const height =
                                      maxCount > 0
                                        ? (count / maxCount) * 40
                                        : 0;
                                    return (
                                      <div
                                        key={level}
                                        className={`w-full ${colors.bar}`}
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
                          {Object.entries(hourData).map(([level, count]) => (
                            <div
                              key={level}
                              className="flex items-center gap-2"
                            >
                              <Badge
                                variant="outline"
                                className={`${levelColors[level].bg} ${levelColors[level].text} border ${levelColors[level].border}`}
                              >
                                {level}
                              </Badge>
                              <span>{count}</span>
                            </div>
                          ))}
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
      </div>
    </ScrollArea>
  );
};

export default LogStats;
