import React, { useState, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import SearchBar from "./log-viewer/SearchBar";
import ActiveFilters from "./log-viewer/ActiveFilters";
import LogDisplay from "./log-viewer/LogDisplay";
import LogStats from "./log-viewer/LogStats";
import TimeRangeFilter from "./log-viewer/TimeRangeFilter";
import { parseLogLine, parseTimestamp } from "@/lib/utils";
import { FilterPresets, type FilterPreset } from "./log-viewer/FilterPresets";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LogFile {
  id: string;
  name: string;
  content: string[];
  startDate?: Date;
  endDate?: Date;
}

const Home = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<
    Array<{ id: string; type: "include" | "exclude"; term: string }>
  >([]);
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  const activeFile = files.find((f) => f.id === activeFileId);
  const visibleEntries =
    activeFile?.content.filter((line) => {
      const { message } = parseLogLine(line);
      return filters.every((filter) => {
        const matches = message
          .toLowerCase()
          .includes(filter.term.toLowerCase());
        return filter.type === "include" ? matches : !matches;
      });
    }) || [];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const newFiles = Array.from(e.dataTransfer.files);
    const processedFiles = await Promise.all(
      newFiles.map(async (file) => {
        const text = await file.text();
        const lines = text.split("\n");
        const dates = lines
          .map((line) => parseLogLine(line))
          .map((log) => parseTimestamp(log.timestamp))
          .filter((date): date is Date => date !== undefined);

        return {
          id: Math.random().toString(),
          name: file.name,
          content: lines,
          startDate:
            dates.length > 0
              ? new Date(Math.min(...dates.map((d) => d.getTime())))
              : undefined,
          endDate:
            dates.length > 0
              ? new Date(Math.max(...dates.map((d) => d.getTime())))
              : undefined,
        };
      }),
    );

    setFiles((prev) => [...prev, ...processedFiles]);
    if (processedFiles.length > 0 && !activeFileId) {
      setActiveFileId(processedFiles[0].id);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (activeFileId === fileId) {
      setActiveFileId(files.find((f) => f.id !== fileId)?.id || null);
    }
  };

  const handleAddFilter = (term: string, type: "include" | "exclude") => {
    if (!term) return;
    setFilters((prev) => [
      ...prev,
      { id: Math.random().toString(), type, term },
    ]);
  };

  const handleRemoveFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearFilters = () => {
    setFilters([]);
  };

  return (
    <div
      className="min-h-screen bg-background p-4 flex flex-col gap-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold shrink-0">Log File Viewer</h1>
            <ThemeToggle />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <TimeRangeFilter
              startDate={activeFile?.startDate}
              endDate={activeFile?.endDate}
              onRangeChange={(start, end) => {
                if (!activeFile) return;
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === activeFile.id
                      ? { ...f, startDate: start, endDate: end }
                      : f,
                  ),
                );
              }}
            />
            <div className="hidden lg:block text-sm text-muted-foreground whitespace-nowrap">
              Total Lines:{" "}
              <span className="font-medium">
                {activeFile?.content.length.toLocaleString() || 0}
              </span>
              <span className="mx-2">•</span>
              Filtered Lines:{" "}
              <span className="font-medium">
                {visibleEntries.length.toLocaleString()}
              </span>
              <span className="mx-2">•</span>(
              {(
                (visibleEntries.length / (activeFile?.content.length || 1)) *
                100
              ).toFixed(1)}
              % visible)
            </div>
            <Button
              variant="outline"
              onClick={() => document.getElementById("fileInput")?.click()}
              className="whitespace-nowrap"
            >
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Log Files
              </div>
            </Button>
            <input
              id="fileInput"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  const dt = new DataTransfer();
                  Array.from(e.target.files).forEach((file) =>
                    dt.items.add(file),
                  );
                  handleDrop({
                    dataTransfer: dt,
                  } as unknown as React.DragEvent);
                }
              }}
            />
          </div>
        </div>

        {files.length === 0 ? (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center ${isDragging ? "border-primary bg-primary/10" : "border-muted"}`}
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <h3 className="font-semibold text-lg">
                Drop your log files here
              </h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop your log files to start analyzing
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Tabs
              value={activeFileId || undefined}
              onValueChange={setActiveFileId}
            >
              <TabsList className="w-full justify-start h-auto p-0 bg-transparent overflow-x-auto">
                {files.map((file) => (
                  <TabsTrigger
                    key={file.id}
                    value={file.id}
                    className="data-[state=active]:bg-muted relative group"
                  >
                    {file.name}
                    <div
                      role="button"
                      tabIndex={0}
                      className="inline-flex h-4 w-4 ml-2 items-center justify-center rounded-sm opacity-60 hover:opacity-100 hover:bg-muted/50 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(file.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveFile(file.id);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {activeFile && (
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={25}>
                  <LogStats
                    entries={activeFile.content.map((line) => ({
                      lineNumber: 0,
                      ...parseLogLine(line),
                    }))}
                  />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={75}>
                  <div className="flex flex-col h-full">
                    <SearchBar
                      searchTerm={searchTerm}
                      onSearch={setSearchTerm}
                      onAddInclude={(term) => handleAddFilter(term, "include")}
                      onAddExclude={(term) => handleAddFilter(term, "exclude")}
                    />
                    <ActiveFilters
                      filters={filters}
                      entries={activeFile.content}
                      onRemoveFilter={handleRemoveFilter}
                      onClearAll={handleClearFilters}
                      rightContent={
                        <FilterPresets
                          currentFilters={filters}
                          presets={presets}
                          onSavePreset={(name) =>
                            setPresets((prev) => [
                              ...prev,
                              { id: Math.random().toString(), name, filters },
                            ])
                          }
                          onLoadPreset={(preset) => setFilters(preset.filters)}
                          onDeletePreset={(id) =>
                            setPresets((prev) =>
                              prev.filter((p) => p.id !== id),
                            )
                          }
                        />
                      }
                    />
                    <LogDisplay
                      entries={activeFile.content.map((line, i) => ({
                        lineNumber: i + 1,
                        ...parseLogLine(line),
                      }))}
                      filters={filters}
                      searchTerm={searchTerm}
                      onAddInclude={(term) => handleAddFilter(term, "include")}
                      onAddExclude={(term) => handleAddFilter(term, "exclude")}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
