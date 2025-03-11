import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpDown,
  Trash2,
  Clock,
  FileText,
  StickyNote,
  Search,
  FolderOpen,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface RecentFile {
  id: string;
  name: string;
  lastOpened: number; // timestamp
  size?: number; // in bytes
  lines?: number;
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  tags?: string[];
  notes?: string;
}

interface RecentFilesProps {
  onFileSelect: (file: RecentFile) => void;
  onMultipleFilesSelect?: (files: RecentFile[]) => void;
}

type SortField =
  | "name"
  | "lastOpened"
  | "size"
  | "lines"
  | "startDate"
  | "endDate";
type SortDirection = "asc" | "desc";

const RecentFiles: React.FC<RecentFilesProps> = ({
  onFileSelect,
  onMultipleFilesSelect,
}) => {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [sortField, setSortField] = useState<SortField>("lastOpened");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    // First try to load from localStorage for immediate display
    const storedFiles = localStorage.getItem("logTrawler_recentFiles");
    if (storedFiles) {
      try {
        // Immediately show localStorage files
        const parsedFiles = JSON.parse(storedFiles);
        // Only show the 20 most recent files for faster initial render
        if (isMounted) {
          setRecentFiles(parsedFiles.slice(0, 20));
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to parse recent files from localStorage", error);
        if (isMounted) {
          setRecentFiles([]);
          setIsLoading(false);
        }
      }
    } else {
      if (isMounted) {
        setIsLoading(false);
      }
    }

    // Preload the IndexedDB module to avoid delay when actually using it
    const preloadModule = import("@/lib/indexedDB-fix");

    // Load IndexedDB data immediately without delay
    (async () => {
      try {
        // Wait for the module to be loaded
        const { initDB, getLogFilesMetadata } = await preloadModule;
        await initDB();

        // Use a more efficient query that only fetches metadata
        const indexedDBFiles = await getLogFilesMetadata();

        if (indexedDBFiles && indexedDBFiles.length > 0 && isMounted) {
          // Convert IndexedDB files to RecentFile format with optimized mapping
          const formattedFiles = indexedDBFiles.map((file) => ({
            id: file.id,
            name: file.name,
            lastOpened: file.lastOpened,
            size: file.size,
            lines: file.lines,
            startDate: file.startDate,
            endDate: file.endDate,
            tags: file.tags,
            notes: file.notes,
          }));

          // Use a more efficient merge algorithm
          setRecentFiles((prev) => {
            // Create a map of existing files by ID for quick lookup
            const fileMap = new Map(prev.map((file) => [file.id, file]));

            // Add or update files from IndexedDB
            formattedFiles.forEach((file) => {
              fileMap.set(file.id, file);
            });

            // Convert map back to array and sort by lastOpened
            return Array.from(fileMap.values()).sort(
              (a, b) => b.lastOpened - a.lastOpened,
            );
          });
        }
      } catch (error) {
        console.error("Failed to load files from IndexedDB", error);
      }
    })();

    // Clean up function
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Memoize filtered files to avoid recalculating on every render
  const filteredFiles = React.useMemo(() => {
    if (!searchTerm) return recentFiles;

    const searchLower = searchTerm.toLowerCase();
    return recentFiles.filter((file) => {
      // Match on filename
      if (file.name.toLowerCase().includes(searchLower)) return true;

      // Match on tags
      if (
        file.tags &&
        file.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      )
        return true;

      return false;
    });
  }, [recentFiles, searchTerm]);

  // Memoize sorted files to avoid recalculating on every render
  const sortedFiles = React.useMemo(
    () =>
      [...filteredFiles].sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "lastOpened":
            comparison = a.lastOpened - b.lastOpened;
            break;
          case "size":
            comparison = (a.size || 0) - (b.size || 0);
            break;
          case "lines":
            comparison = (a.lines || 0) - (b.lines || 0);
            break;
          case "startDate":
            comparison =
              a.startDate && b.startDate
                ? new Date(a.startDate).getTime() -
                  new Date(b.startDate).getTime()
                : 0;
            break;
          case "endDate":
            comparison =
              a.endDate && b.endDate
                ? new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
                : 0;
            break;
        }
        return sortDirection === "asc" ? comparison : -comparison;
      }),
    [filteredFiles, sortField, sortDirection],
  );

  const clearAllHistory = () => {
    // Clear localStorage
    localStorage.removeItem("logTrawler_recentFiles");
    setRecentFiles([]);

    // Also clear IndexedDB
    try {
      import("@/lib/indexedDB-fix").then(
        ({ getAllLogFiles, deleteLogFile }) => {
          // Get all files first
          getAllLogFiles().then((files) => {
            // Delete each file from IndexedDB
            files.forEach((file) => {
              deleteLogFile(file.id).catch((err) =>
                console.error(
                  `Failed to delete file ${file.id} from IndexedDB:`,
                  err,
                ),
              );
            });
            console.log(
              "Cleared all files from both localStorage and IndexedDB",
            );
          });
        },
      );
    } catch (error) {
      console.error("Error importing IndexedDB module:", error);
    }
  };

  const handleRemoveFile = (id: string) => {
    // Check if the file exists before removing
    const fileToRemove = recentFiles.find((file) => file.id === id);
    if (!fileToRemove) return;

    console.log("Removing file:", fileToRemove.name, "with ID:", id);

    const updatedFiles = recentFiles.filter((file) => file.id !== id);
    setRecentFiles(updatedFiles);
    localStorage.setItem(
      "logTrawler_recentFiles",
      JSON.stringify(updatedFiles),
    );

    // Also remove from IndexedDB if it exists there
    try {
      import("@/lib/indexedDB-fix").then(({ deleteLogFile }) => {
        deleteLogFile(id).catch((err) =>
          console.error("Failed to delete from IndexedDB:", err),
        );
      });
    } catch (error) {
      console.error("Error importing IndexedDB module:", error);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown";
    try {
      return format(new Date(dateStr), "dd MMM yyyy HH:mm:ss");
    } catch (e) {
      return "Invalid date";
    }
  };

  if (recentFiles.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Files
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedFiles.size > 0 && onMultipleFilesSelect) {
                      const filesToOpen = recentFiles.filter((file) =>
                        selectedFiles.has(file.id),
                      );
                      onMultipleFilesSelect(filesToOpen);
                      setSelectionMode(false);
                      setSelectedFiles(new Set());
                    }
                  }}
                  disabled={selectedFiles.size === 0}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Open Selected ({selectedFiles.size})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedFiles(new Set());
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectionMode(true)}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Select Multiple
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Clear Recent Files History
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all recent files from your history and
                    delete all log files from storage. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearAllHistory}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="mt-2 relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading files...
            </span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("name")}
                  >
                    Filename
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("lastOpened")}
                  >
                    Last Opened
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("size")}
                  >
                    Size
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("lines")}
                  >
                    Lines
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("startDate")}
                  >
                    Start Date
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left py-2 font-medium">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => handleSort("endDate")}
                  >
                    End Date
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <tr
                  key={file.id}
                  className={`border-b border-muted hover:bg-muted/50 ${selectedFiles.has(file.id) ? "bg-primary/10" : ""}`}
                  onClick={() => {
                    if (selectionMode) {
                      setSelectedFiles((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(file.id)) {
                          newSet.delete(file.id);
                        } else {
                          newSet.add(file.id);
                        }
                        return newSet;
                      });
                    }
                  }}
                >
                  <td className="py-2">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedFiles((prev) => {
                            const newSet = new Set(prev);
                            if (e.target.checked) {
                              newSet.add(file.id);
                            } else {
                              newSet.delete(file.id);
                            }
                            return newSet;
                          });
                        }}
                        className="mr-2"
                      />
                    )}
                    <button
                      className="flex items-center gap-2 text-primary hover:underline"
                      onClick={(e) => {
                        if (!selectionMode) {
                          onFileSelect(file);
                        }
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      {file.name}
                      {file.notes && file.notes.trim() !== "" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <StickyNote
                                className="h-3 w-3 text-blue-500 ml-1 cursor-help"
                                aria-label="Has notes"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="max-w-xs">
                                <p className="font-semibold text-xs mb-1">
                                  Notes:
                                </p>
                                <p className="text-xs">
                                  {file.notes.length > 200
                                    ? `${file.notes.substring(0, 200)}...`
                                    : file.notes}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </button>
                    {file.tags && file.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {file.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2">
                    {format(new Date(file.lastOpened), "dd MMM yyyy HH:mm")}
                  </td>
                  <td className="py-2">{formatFileSize(file.size)}</td>
                  <td className="py-2">
                    {file.lines?.toLocaleString() || "Unknown"}
                  </td>
                  <td className="py-2">{formatDate(file.startDate)}</td>
                  <td className="py-2">{formatDate(file.endDate)}</td>
                  <td className="py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentFiles;
