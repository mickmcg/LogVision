import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown, Trash2, Clock, FileText } from "lucide-react";
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
}

interface RecentFilesProps {
  onFileSelect: (file: RecentFile) => void;
}

type SortField =
  | "name"
  | "lastOpened"
  | "size"
  | "lines"
  | "startDate"
  | "endDate";
type SortDirection = "asc" | "desc";

const RecentFiles: React.FC<RecentFilesProps> = ({ onFileSelect }) => {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [sortField, setSortField] = useState<SortField>("lastOpened");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    // First try to load from localStorage for backward compatibility
    const storedFiles = localStorage.getItem("logTrawler_recentFiles");
    if (storedFiles) {
      try {
        setRecentFiles(JSON.parse(storedFiles));
      } catch (error) {
        console.error("Failed to parse recent files from localStorage", error);
        setRecentFiles([]);
      }
    }

    // Then try to load from IndexedDB and merge with localStorage files
    const loadFromIndexedDB = async () => {
      try {
        const { getAllLogFiles } = await import("@/lib/indexedDB");
        const indexedDBFiles = await getAllLogFiles();

        if (indexedDBFiles && indexedDBFiles.length > 0) {
          // Convert IndexedDB files to RecentFile format
          const formattedFiles = indexedDBFiles.map((file) => {
            console.log(
              "IndexedDB file:",
              file.id,
              file.name,
              "Content length:",
              file.content?.length,
            );
            return {
              id: file.id,
              name: file.name,
              lastOpened: file.lastOpened,
              size: file.size,
              lines: file.content?.length,
              startDate: file.startDate,
              endDate: file.endDate,
            };
          });

          // Merge with localStorage files, prioritizing IndexedDB entries
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
    };

    loadFromIndexedDB();
  }, []);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedFiles = [...recentFiles].sort((a, b) => {
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
            ? new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
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
  });

  const clearAllHistory = () => {
    // Clear localStorage
    localStorage.removeItem("logTrawler_recentFiles");
    setRecentFiles([]);

    // Also clear IndexedDB
    try {
      import("@/lib/indexedDB").then(({ getAllLogFiles, deleteLogFile }) => {
        getAllLogFiles().then((files) => {
          files.forEach((file) => {
            deleteLogFile(file.id).catch((err) =>
              console.error("Failed to delete file from IndexedDB:", err),
            );
          });
        });
      });
    } catch (error) {
      console.error("Error importing IndexedDB module:", error);
    }
  };

  const handleRemoveFile = (id: string) => {
    const updatedFiles = recentFiles.filter((file) => file.id !== id);
    setRecentFiles(updatedFiles);
    localStorage.setItem(
      "logTrawler_recentFiles",
      JSON.stringify(updatedFiles),
    );

    // Also remove from IndexedDB if it exists there
    try {
      import("@/lib/indexedDB").then(({ deleteLogFile }) => {
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

  if (recentFiles.length === 0) {
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
                <AlertDialogTitle>Clear Recent Files History</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all recent files from your history. This
                  action cannot be undone.
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
      </CardHeader>
      <CardContent>
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
                  className="border-b border-muted hover:bg-muted/50"
                >
                  <td className="py-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex items-center gap-2 text-primary hover:underline"
                            onClick={() => onFileSelect(file)}
                          >
                            <FileText className="h-4 w-4" />
                            {file.name}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Click to open from IndexedDB or file selector if not
                            found.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
