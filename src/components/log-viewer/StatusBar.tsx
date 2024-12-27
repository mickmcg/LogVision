import React from "react";
import { Badge } from "../ui/badge";

interface StatusBarProps {
  totalLines?: number;
  filteredLines?: number;
}

const StatusBar = ({
  totalLines = 1000,
  filteredLines = 500,
}: StatusBarProps) => {
  return (
    <div className="h-10 bg-background border-t flex items-center justify-between px-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-4">
        <div>
          Total Lines:{" "}
          <Badge variant="secondary">{totalLines.toLocaleString()}</Badge>
        </div>
        <div>
          Filtered Lines:{" "}
          <Badge variant="secondary">{filteredLines.toLocaleString()}</Badge>
        </div>
      </div>
      <div>
        Showing {((filteredLines / totalLines) * 100).toFixed(1)}% of total
        lines
      </div>
    </div>
  );
};

export default StatusBar;
