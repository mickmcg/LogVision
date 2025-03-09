import React, { useState, useCallback, useMemo } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SearchBar from "./log-viewer/SearchBar";
import ActiveFilters from "./log-viewer/ActiveFilters";
import LogDisplay from "./log-viewer/LogDisplay";
import LogStats from "./log-viewer/LogStats";
import TimeRangeFilter from "./log-viewer/TimeRangeFilter";
import TimeSeriesChart from "./log-viewer/TimeSeriesChart";
import RecentFiles, { RecentFile } from "./log-viewer/RecentFiles";
import { parseLogLine, parseTimestamp } from "@/lib/utils";
import { FilterPresets, type FilterPreset } from "./log-viewer/FilterPresets";
import ExportButton from "./log-viewer/ExportButton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LogFile {
  id: string;
  name: string;
  content: string[];
  startDate?: Date;
  endDate?: Date;
  filters?: Array<{
    id: string;
    type: "include" | "exclude";
    term: string;
    isRegex?: boolean;
    operator?: "AND" | "OR";
  }>;
  filterLogic?: "AND" | "OR";
  bucketSize?: string;
  timeRange?: { startDate?: Date; endDate?: Date };
  isLoading?: boolean;
}

const Home = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRegexSearch, setIsRegexSearch] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [processedEntries, setProcessedEntries] = useState<any[]>([]);
  const [visibleEntries, setVisibleEntries] = useState<any[]>([]);
  const [statsVisible, setStatsVisible] = useState(() => {
    // Auto-hide stats panel on mobile/narrow screens
    return window.innerWidth >= 768; // 768px is the md breakpoint in Tailwind
  });
  const [loadingFiles, setLoadingFiles] = useState<{ [key: string]: number }>(
    {},
  );

  const activeFile = files.find((f) => f.id === activeFileId);

  // Process file content only when active file changes
  React.useEffect(() => {
    if (!activeFile) {
      setProcessedEntries([]);
      setVisibleEntries([]);
      return;
    }

    // Reset the lastValidTimestamp before processing a new file
    // This is a workaround since we can't directly reset the module variable
    parseLogLine(undefined);
    parseLogLine("-");

    try {
      // For very large files, process in batches to avoid UI freezing
      if (activeFile.content.length > 10000) {
        // Start with a smaller batch for immediate feedback
        const initialBatch = activeFile.content
          .slice(0, 2000)
          .map((line, i) => ({
            lineNumber: i + 1,
            ...parseLogLine(line),
          }));
        setProcessedEntries(initialBatch);

        // Process the rest in the background with web workers if available
        const useWebWorker = window.Worker !== undefined;

        if (useWebWorker) {
          // Create a string version of the worker function
          const workerFunctionStr = `
            self.onmessage = function(e) {
              const { lines, startIndex, parseTimestampOnly } = e.data;
              const results = [];
              
              // Simple timestamp extraction for worker
              const parseLogLine = (line) => {
                if (!line || !line.trim()) return { timestamp: "-", message: line || "" };
                
                // Try to match common timestamp patterns
                const timestampRegex = /(\\d{4}-\\d{2}-\\d{2}(?:[T\\s])\\d{1,2}:\\d{2}:\\d{2}(?:\\.\\d{3})?(?:[Z])?|\\d{2}[-/](?:[A-Za-z]+|\\d{2})[-/]\\d{4}(?:\\s|:)\\d{1,2}:\\d{2}:\\d{2}(?:\\.\\d{3})?|\\d{4}\\/\\d{2}\\/\\d{2}\\s\\d{1,2}:\\d{2}:\\d{2}(?:\\.\\d{3})?)/.exec(line);
                
                if (timestampRegex) {
                  return { timestamp: timestampRegex[1], message: line };
                }
                
                return { timestamp: "-", message: line };
              };
              
              for (let i = 0; i < lines.length; i++) {
                results.push({
                  lineNumber: startIndex + i + 1,
                  ...parseLogLine(lines[i])
                });
              }
              
              self.postMessage(results);
            };
          `;

          // Create a blob from the worker function string
          const blob = new Blob([workerFunctionStr], {
            type: "application/javascript",
          });
          const workerUrl = URL.createObjectURL(blob);
          const worker = new Worker(workerUrl);

          // Set up batch processing with the worker
          const batchSize = 20000; // Larger batches for worker
          let currentIndex = 2000;

          worker.onmessage = (e) => {
            const results = e.data;
            setProcessedEntries((prev) => [...prev, ...results]);

            currentIndex += batchSize;
            if (currentIndex < activeFile.content.length) {
              const nextBatch = activeFile.content.slice(
                currentIndex,
                currentIndex + batchSize,
              );
              worker.postMessage({
                lines: nextBatch,
                startIndex: currentIndex,
                parseTimestampOnly: true,
              });
            } else {
              // Clean up when done
              worker.terminate();
              URL.revokeObjectURL(workerUrl);
            }
          };

          // Start the first worker batch
          const firstBatch = activeFile.content.slice(2000, 2000 + batchSize);
          worker.postMessage({
            lines: firstBatch,
            startIndex: 2000,
            parseTimestampOnly: true,
          });
        } else {
          // Fallback to setTimeout approach with optimized batch processing
          setTimeout(() => {
            const batchSize = 15000;
            let currentIndex = 2000;

            const processNextBatch = () => {
              if (currentIndex >= activeFile.content.length) return;

              const endIndex = Math.min(
                currentIndex + batchSize,
                activeFile.content.length,
              );

              // Process batch with requestAnimationFrame for better UI responsiveness
              requestAnimationFrame(() => {
                const nextBatch = [];
                const batchLines = activeFile.content.slice(
                  currentIndex,
                  endIndex,
                );

                for (let i = 0; i < batchLines.length; i++) {
                  nextBatch.push({
                    lineNumber: currentIndex + i + 1,
                    ...parseLogLine(batchLines[i]),
                  });
                }

                setProcessedEntries((prev) => [...prev, ...nextBatch]);

                currentIndex += batchSize;
                if (currentIndex < activeFile.content.length) {
                  // Use requestIdleCallback if available, otherwise setTimeout
                  if (window.requestIdleCallback) {
                    window.requestIdleCallback(processNextBatch, {
                      timeout: 500,
                    });
                  } else {
                    setTimeout(processNextBatch, 10);
                  }
                }
              });
            };

            processNextBatch();
          }, 50);
        }
      } else {
        // For smaller files, process all at once
        const processed = activeFile.content.map((line, i) => ({
          lineNumber: i + 1,
          ...parseLogLine(line),
        }));
        setProcessedEntries(processed);
      }
    } catch (error) {
      console.error("Error processing entries:", error);
      // Add an error entry
      setProcessedEntries([
        {
          lineNumber: 1,
          timestamp: new Date().toISOString(),
          message: `[ERROR] Failed to process file. The file may be too large or contain invalid data.`,
        },
      ]);
    }
  }, [activeFile]);

  // Filter entries when filters or time range changes
  React.useEffect(() => {
    if (!processedEntries.length || !activeFile) {
      setVisibleEntries([]);
      return;
    }

    const filtered = processedEntries.filter((entry) => {
      // Time range filter
      if (activeFile.timeRange?.startDate || activeFile.timeRange?.endDate) {
        const entryDate = parseTimestamp(entry.timestamp);
        if (entryDate) {
          if (
            activeFile.timeRange?.startDate &&
            entryDate < activeFile.timeRange.startDate
          ) {
            return false;
          }
          if (
            activeFile.timeRange?.endDate &&
            entryDate > activeFile.timeRange.endDate
          ) {
            return false;
          }
        }
      }

      // Text filters
      const filters = activeFile.filters || [];
      const filterLogic = activeFile.filterLogic || "OR";

      const excludeFilters = filters.filter((f) => f.type === "exclude");
      const includeFilters = filters.filter((f) => f.type === "include");

      if (excludeFilters.length > 0) {
        const shouldExclude = excludeFilters.some((filter) => {
          if (filter.isRegex) {
            try {
              const regex = new RegExp(filter.term, "i");
              return regex.test(entry.message);
            } catch (error) {
              console.error("Invalid regex pattern:", error);
              return false;
            }
          }
          return entry.message
            .toLowerCase()
            .includes(filter.term.toLowerCase());
        });
        if (shouldExclude) return false;
      }

      if (includeFilters.length > 0) {
        if (filterLogic === "AND") {
          return includeFilters.every((filter) => {
            if (filter.isRegex) {
              try {
                const regex = new RegExp(filter.term, "i");
                return regex.test(entry.message);
              } catch (error) {
                console.error("Invalid regex pattern:", error);
                return false;
              }
            }
            return entry.message
              .toLowerCase()
              .includes(filter.term.toLowerCase());
          });
        } else {
          return includeFilters.some((filter) => {
            if (filter.isRegex) {
              try {
                const regex = new RegExp(filter.term, "i");
                return regex.test(entry.message);
              } catch (error) {
                console.error("Invalid regex pattern:", error);
                return false;
              }
            }
            return entry.message
              .toLowerCase()
              .includes(filter.term.toLowerCase());
          });
        }
      }

      return true;
    });

    setVisibleEntries(filtered);
  }, [processedEntries, activeFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRecentFileSelect = async (recentFile: RecentFile) => {
    try {
      // Show loading notification
      const notification = document.createElement("div");
      notification.className =
        "fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-md z-50";
      notification.innerHTML = `Loading <strong>${recentFile.name}</strong> from storage...`;
      document.body.appendChild(notification);

      // Import IndexedDB functions
      const { getLogFileById } = await import("@/lib/indexedDB");

      // Try to load from IndexedDB
      const logFile = await getLogFileById(recentFile.id);
      console.log(
        "Loaded file from IndexedDB:",
        logFile?.id,
        logFile?.name,
        "Content length:",
        logFile?.content?.length,
      );

      if (logFile && logFile.content && logFile.content.length > 0) {
        // Convert date strings back to Date objects
        const processedFile = {
          ...logFile,
          startDate: logFile.startDate
            ? new Date(logFile.startDate)
            : undefined,
          endDate: logFile.endDate ? new Date(logFile.endDate) : undefined,
          timeRange: logFile.timeRange
            ? {
                startDate: logFile.timeRange.startDate
                  ? new Date(logFile.timeRange.startDate)
                  : undefined,
                endDate: logFile.timeRange.endDate
                  ? new Date(logFile.timeRange.endDate)
                  : undefined,
              }
            : undefined,
        };

        // Add file to state
        setFiles((prev) => {
          // Check if file already exists
          const existingFileIndex = prev.findIndex(
            (f) => f.id === processedFile.id,
          );
          if (existingFileIndex >= 0) {
            // Replace existing file
            const newFiles = [...prev];
            newFiles[existingFileIndex] = processedFile;
            return newFiles;
          } else {
            // Add new file
            return [...prev, processedFile];
          }
        });

        // Set as active file
        setActiveFileId(processedFile.id);

        // Update notification
        notification.innerHTML = `Successfully loaded <strong>${recentFile.name}</strong>`;
        notification.className =
          "fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-md z-50";

        // Remove notification after 3 seconds
        setTimeout(() => {
          notification.classList.add(
            "opacity-0",
            "transition-opacity",
            "duration-500",
          );
          setTimeout(() => document.body.removeChild(notification), 500);
        }, 3000);

        return;
      }

      // If we get here, the file wasn't in IndexedDB or was empty
      notification.innerHTML = `Please select <strong>${recentFile.name}</strong> from the file dialog`;

      // Trigger the file input click to open the file selector dialog
      const fileInput = document.getElementById(
        "fileInput",
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }

      // Remove the notification after 5 seconds
      setTimeout(() => {
        notification.classList.add(
          "opacity-0",
          "transition-opacity",
          "duration-500",
        );
        setTimeout(() => document.body.removeChild(notification), 500);
      }, 5000);
    } catch (error) {
      console.error("Error loading file from IndexedDB:", error);

      // Show error notification
      const errorNotification = document.createElement("div");
      errorNotification.className =
        "fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-md shadow-md z-50";
      errorNotification.innerHTML = `Error loading file. Please select it manually.`;
      document.body.appendChild(errorNotification);

      // Trigger the file input click as fallback
      const fileInput = document.getElementById(
        "fileInput",
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }

      // Remove notification after 5 seconds
      setTimeout(() => {
        errorNotification.classList.add(
          "opacity-0",
          "transition-opacity",
          "duration-500",
        );
        setTimeout(() => document.body.removeChild(errorNotification), 500);
      }, 5000);
    }
  };

  const processFiles = async (files: File[]) => {
    // Create temporary IDs for loading files
    const loadingFileIds = files.map((file) => ({
      id: Math.random().toString(),
      name: file.name,
    }));

    // Add loading files to state with 0% progress
    const newLoadingFiles = {};
    loadingFileIds.forEach((file) => {
      newLoadingFiles[file.id] = 0;
    });
    setLoadingFiles((prev) => ({ ...prev, ...newLoadingFiles }));

    // Add placeholder files to the files list
    setFiles((prev) => [
      ...prev,
      ...loadingFileIds.map((file) => ({
        id: file.id,
        name: file.name,
        content: [],
        isLoading: true,
      })),
    ]);

    // Set active file to the first loading file
    if (loadingFileIds.length > 0) {
      setActiveFileId(loadingFileIds[0].id);
    }

    const processedFiles = await Promise.all(
      files.map(async (file, index) => {
        const fileId = loadingFileIds[index].id;
        const isLargeFile = file.size > 50 * 1024 * 1024; // Lower threshold to 50MB
        const isVeryLargeFile = file.size > 200 * 1024 * 1024; // 200MB threshold

        // Read file as text with progress tracking
        const reader = new FileReader();
        let lines: string[] = [];

        try {
          if (isLargeFile) {
            // For large files, use chunked processing with optimizations
            const chunkSize = isVeryLargeFile
              ? 20 * 1024 * 1024
              : 10 * 1024 * 1024; // Larger chunks for very large files
            const totalChunks = Math.ceil(file.size / chunkSize);
            let loadedChunks = 0;
            let processedLines: string[] = [];

            // Use a more efficient approach for very large files
            if (isVeryLargeFile) {
              // For extremely large files, process only a subset of chunks
              const maxChunksToProcess = 10; // Process only first 10 chunks (200MB of data)
              const chunksToProcess = Math.min(totalChunks, maxChunksToProcess);

              for (let i = 0; i < chunksToProcess; i++) {
                // Process chunks from beginning, middle and end for better representation
                let chunkIndex;
                if (i < 4) {
                  // First 4 chunks from beginning
                  chunkIndex = i;
                } else if (i < 7) {
                  // 3 chunks from middle
                  chunkIndex = Math.floor(totalChunks / 2) + (i - 4);
                } else {
                  // 3 chunks from end
                  chunkIndex = totalChunks - (10 - i);
                }

                const start = chunkIndex * chunkSize;
                const chunk = file.slice(start, start + chunkSize);
                const chunkText = await new Promise<string>((resolve) => {
                  const chunkReader = new FileReader();
                  chunkReader.onload = (e) =>
                    resolve(e.target?.result as string);
                  chunkReader.readAsText(chunk);
                });

                const chunkLines = chunkText.split("\n");
                processedLines = [...processedLines, ...chunkLines];

                loadedChunks++;
                const progress = Math.round(
                  (loadedChunks / chunksToProcess) * 100,
                );
                setLoadingFiles((prev) => ({ ...prev, [fileId]: progress }));
              }

              // Add a notice that this is a partial file
              processedLines.unshift(
                `[NOTICE] This file is very large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Showing a representative sample.`,
              );
            } else {
              // For large but not extreme files, process all chunks sequentially
              for (let start = 0; start < file.size; start += chunkSize) {
                const chunk = file.slice(start, start + chunkSize);
                const chunkText = await new Promise<string>((resolve) => {
                  const chunkReader = new FileReader();
                  chunkReader.onload = (e) =>
                    resolve(e.target?.result as string);
                  chunkReader.readAsText(chunk);
                });

                // Process chunk more efficiently
                const chunkLines = chunkText.split("\n");

                // If not the first chunk, the first line might be incomplete - append to the last line of previous chunk
                if (
                  start > 0 &&
                  processedLines.length > 0 &&
                  chunkLines.length > 0
                ) {
                  processedLines[processedLines.length - 1] += chunkLines[0];
                  // Use a more efficient way to append arrays
                  processedLines.push(...chunkLines.slice(1));
                } else {
                  processedLines.push(...chunkLines);
                }

                loadedChunks++;
                const progress = Math.round((loadedChunks / totalChunks) * 100);
                setLoadingFiles((prev) => ({ ...prev, [fileId]: progress }));
              }
            }

            // Sample the lines for very large files
            const maxLines = isVeryLargeFile ? 200000 : 500000; // Lower limit for very large files
            if (processedLines.length > maxLines) {
              const samplingRate = Math.ceil(processedLines.length / maxLines);
              // More efficient sampling
              const sampledLines = [];
              for (let i = 0; i < processedLines.length; i += samplingRate) {
                sampledLines.push(processedLines[i]);
              }
              lines = sampledLines;
              console.log(
                `Sampled large file from ${processedLines.length} to ${lines.length} lines`,
              );
            } else {
              lines = processedLines;
            }
          } else {
            // For smaller files, use the standard approach with optimizations
            const text = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);

              // Update progress during load
              reader.onprogress = (event) => {
                if (event.lengthComputable) {
                  const progress = Math.round(
                    (event.loaded / event.total) * 100,
                  );
                  setLoadingFiles((prev) => ({ ...prev, [fileId]: progress }));
                }
              };

              reader.readAsText(file);
            });

            // More efficient string splitting for moderate-sized files
            lines = text.split("\n");
          }
        } catch (error) {
          console.error("Error processing file:", error);
          // Return a minimal set of lines with an error message
          lines = [
            `[ERROR] Failed to process file: ${file.name}. File may be too large or corrupted.`,
          ];
        }
        const dates = [];

        // Reset the lastValidTimestamp before processing the file
        parseLogLine(undefined);
        parseLogLine("-");

        // First, try to get the first valid timestamp from the beginning of the file
        let firstDate = null;
        // Always check the first line first
        if (lines[0] && lines[0].trim()) {
          const parsed = parseLogLine(lines[0]);
          const date = parseTimestamp(parsed.timestamp);
          if (date) {
            firstDate = date;
            dates.push(date);
          }
        }

        // If first line didn't have a valid timestamp, scan more lines
        if (!firstDate) {
          const maxLinesToCheck = Math.min(1000, lines.length);
          for (let i = 1; i < maxLinesToCheck; i++) {
            if (!lines[i] || !lines[i].trim()) continue;
            const parsed = parseLogLine(lines[i]);
            const date = parseTimestamp(parsed.timestamp);
            if (date) {
              firstDate = date;
              dates.push(date);
              break;
            }
          }
        }

        // Then, try to get the last valid timestamp from the end of the file
        let lastDate = null;
        const maxEndLinesToCheck = Math.min(1000, lines.length);
        for (
          let i = lines.length - 1;
          i >= Math.max(0, lines.length - maxEndLinesToCheck);
          i--
        ) {
          if (!lines[i] || !lines[i].trim()) continue;
          const parsed = parseLogLine(lines[i]);
          const date = parseTimestamp(parsed.timestamp);
          if (date) {
            lastDate = date;
            dates.push(date);
            break;
          }
        }

        // If we couldn't find timestamps at the beginning or end, sample the file
        if (!firstDate || !lastDate) {
          const sampleSize = Math.min(1000, lines.length);
          const step = Math.max(1, Math.floor(lines.length / sampleSize));

          for (let i = 0; i < lines.length; i += step) {
            if (!lines[i] || !lines[i].trim()) continue;
            const parsed = parseLogLine(lines[i]);
            const date = parseTimestamp(parsed.timestamp);
            if (date) dates.push(date);
          }
        }

        const startDate =
          dates.length > 0
            ? new Date(Math.min(...dates.map((d) => d.getTime())))
            : undefined;
        const endDate =
          dates.length > 0
            ? new Date(Math.max(...dates.map((d) => d.getTime())))
            : undefined;

        // Calculate appropriate bucket size based on time range
        let bucketSize = "5m";
        if (startDate && endDate) {
          const diffMs = endDate.getTime() - startDate.getTime();
          const diffMinutes = diffMs / (1000 * 60);
          const targetBuckets = 120; // Aim for more granular bars (120 = 30 sec intervals for 1 hour)

          // Special cases for small time ranges
          if (diffMinutes <= 1) {
            bucketSize = "5s";
          } else if (diffMinutes <= 60) {
            bucketSize = "30s";
          } else {
            const idealBucketSizeMinutes = Math.max(
              1,
              Math.ceil(diffMinutes / targetBuckets),
            );

            // Round to standard bucket sizes
            if (idealBucketSizeMinutes <= 0.08) bucketSize = "5s";
            else if (idealBucketSizeMinutes <= 0.17) bucketSize = "10s";
            else if (idealBucketSizeMinutes <= 0.5) bucketSize = "30s";
            else if (idealBucketSizeMinutes <= 1) bucketSize = "1m";
            else if (idealBucketSizeMinutes <= 5) bucketSize = "5m";
            else if (idealBucketSizeMinutes <= 10) bucketSize = "10m";
            else if (idealBucketSizeMinutes <= 30) bucketSize = "30m";
            else if (idealBucketSizeMinutes <= 60) bucketSize = "60m";
            else if (idealBucketSizeMinutes <= 360) bucketSize = "360m";
            else if (idealBucketSizeMinutes <= 720) bucketSize = "720m";
            else if (idealBucketSizeMinutes <= 1440) bucketSize = "1440m";
            else bucketSize = "10080m";
          }
        }

        // Save to recent files in localStorage
        const recentFile = {
          id: fileId,
          name: file.name,
          lastOpened: Date.now(),
          size: file.size,
          lines: lines.length,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        };

        // Update recent files in localStorage
        try {
          const storedFiles = localStorage.getItem("logTrawler_recentFiles");
          let recentFiles: RecentFile[] = [];

          if (storedFiles) {
            recentFiles = JSON.parse(storedFiles);
          }

          // Remove any existing entry for this file name to avoid duplicates
          recentFiles = recentFiles.filter((f) => f.name !== file.name);

          // Add the new file to the beginning (most recent)
          recentFiles.unshift(recentFile);

          // Limit to 20 recent files
          if (recentFiles.length > 20) {
            recentFiles = recentFiles.slice(0, 20);
          }

          localStorage.setItem(
            "logTrawler_recentFiles",
            JSON.stringify(recentFiles),
          );
        } catch (error) {
          console.error("Failed to update recent files in localStorage", error);
        }

        // Create the processed file object
        const processedFile = {
          id: fileId,
          name: file.name,
          content: lines,
          startDate,
          endDate,
          bucketSize,
          isLoading: false,
        };

        // Save to IndexedDB
        try {
          import("@/lib/indexedDB").then(({ saveLogFile }) => {
            saveLogFile({
              ...processedFile,
              content: lines, // Ensure content is included
              lastOpened: Date.now(),
              size: file.size,
              startDate: startDate?.toISOString(),
              endDate: endDate?.toISOString(),
            }).catch((err) =>
              console.error("Failed to save to IndexedDB:", err),
            );
          });
        } catch (error) {
          console.error("Error importing IndexedDB module:", error);
        }

        return processedFile;
      }),
    );

    // Replace loading files with processed files
    setFiles((prev) =>
      prev.map((file) => {
        const processedFile = processedFiles.find((pf) => pf.id === file.id);
        return processedFile || file;
      }),
    );

    // Clear loading state
    const clearedLoadingFiles = {};
    loadingFileIds.forEach((file) => {
      clearedLoadingFiles[file.id] = 100;
    });
    setLoadingFiles((prev) => ({ ...prev, ...clearedLoadingFiles }));

    // After a short delay, remove the loading indicators completely
    setTimeout(() => {
      setLoadingFiles((prev) => {
        const newState = { ...prev };
        loadingFileIds.forEach((file) => {
          delete newState[file.id];
        });
        return newState;
      });
    }, 500);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const newFiles = Array.from(e.dataTransfer.files);
    await processFiles(newFiles);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (activeFileId === fileId) {
      setActiveFileId(files.find((f) => f.id !== fileId)?.id || null);
    }

    // Also remove from IndexedDB
    try {
      import("@/lib/indexedDB").then(({ deleteLogFile }) => {
        deleteLogFile(fileId).catch((err) =>
          console.error("Failed to delete from IndexedDB:", err),
        );
      });
    } catch (error) {
      console.error("Error importing IndexedDB module:", error);
    }
  };

  const handleAddFilter = (
    term: string,
    type: "include" | "exclude",
    isRegex = false,
  ) => {
    if (!term || !activeFile) return;

    const updatedFiles = (prev) => {
      return prev.map((file) => {
        if (file.id === activeFile.id) {
          const currentFilters = file.filters || [];
          const updatedFile = {
            ...file,
            filters: [
              ...currentFilters,
              { id: Math.random().toString(), type, term, isRegex },
            ],
          };

          // Update in IndexedDB
          try {
            import("@/lib/indexedDB").then(({ updateLogFile }) => {
              updateLogFile(file.id, {
                filters: updatedFile.filters,
              }).catch((err) =>
                console.error("Failed to update filters in IndexedDB:", err),
              );
            });
          } catch (error) {
            console.error("Error importing IndexedDB module:", error);
          }

          return updatedFile;
        }
        return file;
      });
    };

    setFiles(updatedFiles);
  };

  const handleFilterLogicChange = (logic: "AND" | "OR") => {
    if (!activeFile) return;

    setFiles((prev) =>
      prev.map((file) => {
        if (file.id === activeFile.id) {
          const updatedFile = {
            ...file,
            filterLogic: logic,
          };

          // Update in IndexedDB
          try {
            import("@/lib/indexedDB").then(({ updateLogFile }) => {
              updateLogFile(file.id, {
                filterLogic: logic,
              }).catch((err) =>
                console.error(
                  "Failed to update filter logic in IndexedDB:",
                  err,
                ),
              );
            });
          } catch (error) {
            console.error("Error importing IndexedDB module:", error);
          }

          return updatedFile;
        }
        return file;
      }),
    );
  };

  const handleRemoveFilter = (id: string) => {
    if (!activeFile) return;

    setFiles((prev) =>
      prev.map((file) => {
        if (file.id === activeFile.id && file.filters) {
          return {
            ...file,
            filters: file.filters.filter((f) => f.id !== id),
          };
        }
        return file;
      }),
    );
  };

  const handleClearFilters = () => {
    if (!activeFile) return;

    setFiles((prev) =>
      prev.map((file) => {
        if (file.id === activeFile.id) {
          return {
            ...file,
            filters: [],
          };
        }
        return file;
      }),
    );
  };

  const handleTimeRangeSelect = (startDate?: Date, endDate?: Date) => {
    if (!activeFile) return;

    setFiles((prev) =>
      prev.map((file) => {
        if (file.id === activeFile.id) {
          const updatedFile = {
            ...file,
            timeRange: { startDate, endDate },
          };

          // Update in IndexedDB
          try {
            import("@/lib/indexedDB").then(({ updateLogFile }) => {
              updateLogFile(file.id, {
                timeRange: {
                  startDate: startDate?.toISOString(),
                  endDate: endDate?.toISOString(),
                },
              }).catch((err) =>
                console.error("Failed to update time range in IndexedDB:", err),
              );
            });
          } catch (error) {
            console.error("Error importing IndexedDB module:", error);
          }

          return updatedFile;
        }
        return file;
      }),
    );
  };

  const handleBucketSizeChange = (size: string) => {
    if (!activeFile) return;

    setFiles((prev) =>
      prev.map((file) => {
        if (file.id === activeFile.id) {
          const updatedFile = {
            ...file,
            bucketSize: size,
            // Preserve the existing time range when changing bucket size
            timeRange: file.timeRange,
          };

          // Update in IndexedDB
          try {
            import("@/lib/indexedDB").then(({ updateLogFile }) => {
              updateLogFile(file.id, {
                bucketSize: size,
              }).catch((err) =>
                console.error(
                  "Failed to update bucket size in IndexedDB:",
                  err,
                ),
              );
            });
          } catch (error) {
            console.error("Error importing IndexedDB module:", error);
          }

          return updatedFile;
        }
        return file;
      }),
    );
  };

  const handleSearch = (term: string, isRegex: boolean = false) => {
    setSearchTerm(term);
    setIsRegexSearch(isRegex);
  };

  // Memoize chart entries to avoid re-processing on every render
  const chartEntries = useMemo(() => {
    if (!activeFile) return [];
    // Use a sample of entries for the chart to improve performance
    const sampleSize = Math.min(5000, activeFile.content.length);
    const step = Math.max(
      1,
      Math.floor(activeFile.content.length / sampleSize),
    );
    const sample = [];
    for (let i = 0; i < activeFile.content.length; i += step) {
      sample.push(activeFile.content[i]);
    }
    return sample;
  }, [activeFile]);

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
            <div className="flex items-center gap-2">
              <img
                src="/fish-icon.svg"
                alt="LogTrawler logo"
                className="w-6 h-6 dark:invert"
              />
              <h1 className="text-xl font-semibold shrink-0 text-blue-500">
                LogTrawler
              </h1>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <TimeRangeFilter
              startDate={
                activeFile?.timeRange?.startDate || activeFile?.startDate
              }
              endDate={activeFile?.timeRange?.endDate || activeFile?.endDate}
              onRangeChange={(start, end) => {
                // Update the time range in the same way as chart selection
                handleTimeRangeSelect(start, end);

                // Reset the chart selection when using the date pickers
                if (activeFile) {
                  setFiles((prev) =>
                    prev.map((file) => {
                      if (file.id === activeFile.id) {
                        return {
                          ...file,
                          timeRange: { startDate: start, endDate: end },
                        };
                      }
                      return file;
                    }),
                  );
                }
              }}
            />
            <div className="hidden lg:block text-sm text-muted-foreground whitespace-nowrap">
              Total Lines:{" "}
              <span className="font-medium">
                {activeFile?.content.length.toLocaleString() || 0}
              </span>
              <span className="mx-2">•</span>
              Visible Lines:{" "}
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
            {activeFile && (
              <ExportButton
                fileName={activeFile.name}
                content={visibleEntries.map(
                  (entry) => activeFile.content[entry.lineNumber - 1],
                )}
                disabled={!visibleEntries.length}
              />
            )}
            <Button
              variant="outline"
              onClick={() => document.getElementById("fileInput")?.click()}
              className="whitespace-nowrap"
            >
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Open Log File
              </div>
            </Button>
            <input
              id="fileInput"
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                if (e.target.files) {
                  await processFiles(Array.from(e.target.files));
                }
              }}
            />
          </div>
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col gap-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center ${isDragging ? "border-primary bg-primary/10" : "border-muted"}`}
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h3 className="font-semibold text-lg">
                  Drop your log files here
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop your log files to start analyzing. Files are
                  processed 100% locally within your browser and not uploaded to
                  the internet.
                </p>
              </div>
            </div>
            <RecentFiles onFileSelect={handleRecentFileSelect} />
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
                    className="data-[state=active]:bg-muted relative group overflow-hidden"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const contextMenu = document.createElement("div");
                      contextMenu.className =
                        "fixed z-50 bg-popover text-popover-foreground rounded-md border shadow-md p-1 min-w-[12rem]";
                      contextMenu.style.left = `${e.clientX}px`;
                      contextMenu.style.top = `${e.clientY}px`;

                      const createMenuItem = (text, onClick) => {
                        const item = document.createElement("button");
                        item.className =
                          "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground";
                        item.textContent = text;
                        item.onclick = onClick;
                        return item;
                      };

                      // Close tab
                      contextMenu.appendChild(
                        createMenuItem("Close tab", () => {
                          handleRemoveFile(file.id);
                          document.body.removeChild(contextMenu);
                        }),
                      );

                      // Close other tabs
                      contextMenu.appendChild(
                        createMenuItem("Close other tabs", () => {
                          setFiles((prev) =>
                            prev.filter((f) => f.id === file.id),
                          );
                          setActiveFileId(file.id);
                          document.body.removeChild(contextMenu);
                        }),
                      );

                      // Close tabs to the left
                      contextMenu.appendChild(
                        createMenuItem("Close tabs to the left", () => {
                          const fileIndex = files.findIndex(
                            (f) => f.id === file.id,
                          );
                          if (fileIndex > 0) {
                            setFiles((prev) =>
                              prev.filter((f, i) => i >= fileIndex),
                            );
                            setActiveFileId(file.id);
                          }
                          document.body.removeChild(contextMenu);
                        }),
                      );

                      // Close tabs to the right
                      contextMenu.appendChild(
                        createMenuItem("Close tabs to the right", () => {
                          const fileIndex = files.findIndex(
                            (f) => f.id === file.id,
                          );
                          if (fileIndex < files.length - 1) {
                            setFiles((prev) =>
                              prev.filter((f, i) => i <= fileIndex),
                            );
                            setActiveFileId(file.id);
                          }
                          document.body.removeChild(contextMenu);
                        }),
                      );

                      document.body.appendChild(contextMenu);

                      // Remove the context menu when clicking outside
                      const removeContextMenu = () => {
                        if (document.body.contains(contextMenu)) {
                          document.body.removeChild(contextMenu);
                        }
                        document.removeEventListener(
                          "click",
                          removeContextMenu,
                        );
                      };

                      document.addEventListener("click", removeContextMenu);
                    }}
                  >
                    <div className="relative z-10">
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
                    </div>
                    {loadingFiles[file.id] !== undefined && (
                      <div
                        className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/30 z-0 transition-all duration-300"
                        style={{ width: `${loadingFiles[file.id]}%` }}
                      />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {activeFile ? (
              <div className="flex flex-col h-full">
                {activeFile.isLoading && (
                  <div className="bg-muted/20 border rounded-md p-4 mb-4 text-center">
                    <div className="text-sm font-medium mb-2">
                      Loading {activeFile.name}
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 mb-2">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${loadingFiles[activeFile.id] || 0}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {loadingFiles[activeFile.id] || 0}% complete
                    </div>
                  </div>
                )}
                <TimeSeriesChart
                  entries={chartEntries}
                  filteredEntries={visibleEntries.map(
                    (entry) => activeFile.content[entry.lineNumber - 1],
                  )}
                  onTimeRangeSelect={handleTimeRangeSelect}
                  bucketSize={activeFile.bucketSize || "5m"}
                  onBucketSizeChange={handleBucketSizeChange}
                  fileStartDate={activeFile.startDate}
                  fileEndDate={activeFile.endDate}
                  timeRange={activeFile.timeRange}
                />
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel
                    defaultSize={25}
                    collapsible
                    minSize={0}
                    className={statsVisible ? "hidden md:block" : "hidden"}
                  >
                    <LogStats
                      entries={visibleEntries}
                      allEntries={processedEntries}
                      showHourlyActivity={false}
                      onToggle={() => setStatsVisible(!statsVisible)}
                      showStats={statsVisible}
                      onAddFilter={(term, type = "include") =>
                        handleAddFilter(term, type)
                      }
                    />
                  </ResizablePanel>
                  {!statsVisible && (
                    <div className="w-8 flex items-start justify-center pt-4 hidden md:flex">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 sticky top-4"
                        onClick={() => setStatsVisible(true)}
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
                    </div>
                  )}
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={75}>
                    <div className="flex flex-col h-full">
                      <SearchBar
                        searchTerm={searchTerm}
                        isRegex={isRegexSearch}
                        onSearch={handleSearch}
                        onAddInclude={(term, isRegex) =>
                          handleAddFilter(term, "include", isRegex)
                        }
                        onAddExclude={(term, isRegex) =>
                          handleAddFilter(term, "exclude", isRegex)
                        }
                      />
                      <ActiveFilters
                        filters={activeFile.filters || []}
                        entries={
                          activeFile.timeRange?.startDate ||
                          activeFile.timeRange?.endDate
                            ? visibleEntries.map(
                                (entry) =>
                                  activeFile.content[entry.lineNumber - 1],
                              )
                            : activeFile.content
                        }
                        onRemoveFilter={handleRemoveFilter}
                        onToggleFilterType={(id) => {
                          if (!activeFile) return;
                          setFiles((prev) =>
                            prev.map((file) => {
                              if (file.id === activeFile.id && file.filters) {
                                return {
                                  ...file,
                                  filters: file.filters.map((f) =>
                                    f.id === id
                                      ? {
                                          ...f,
                                          type:
                                            f.type === "include"
                                              ? "exclude"
                                              : "include",
                                        }
                                      : f,
                                  ),
                                };
                              }
                              return file;
                            }),
                          );
                        }}
                        onClearAll={handleClearFilters}
                        filterLogic={activeFile.filterLogic || "OR"}
                        onFilterLogicChange={handleFilterLogicChange}
                        rightContent={
                          <FilterPresets
                            currentFilters={activeFile.filters || []}
                            presets={presets}
                            onSavePreset={(name) =>
                              setPresets((prev) => [
                                ...prev,
                                {
                                  id: Math.random().toString(),
                                  name,
                                  filters: activeFile.filters || [],
                                },
                              ])
                            }
                            onLoadPreset={(preset) => {
                              if (!activeFile) return;
                              setFiles((prev) =>
                                prev.map((file) => {
                                  if (file.id === activeFile.id) {
                                    return {
                                      ...file,
                                      filters: preset.filters,
                                    };
                                  }
                                  return file;
                                }),
                              );
                            }}
                            onDeletePreset={(id) =>
                              setPresets((prev) =>
                                prev.filter((p) => p.id !== id),
                              )
                            }
                          />
                        }
                      />
                      <LogDisplay
                        entries={visibleEntries}
                        filters={activeFile.filters || []}
                        searchTerm={searchTerm}
                        onAddInclude={(term) =>
                          handleAddFilter(term, "include")
                        }
                        onAddExclude={(term) =>
                          handleAddFilter(term, "exclude")
                        }
                      />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
