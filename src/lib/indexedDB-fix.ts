// IndexedDB utility for storing and retrieving log files

interface LogFileData {
  id: string;
  name: string;
  content: string[];
  startDate?: string;
  endDate?: string;
  size?: number;
  lastOpened: number;
  filters?: Array<{
    id: string;
    type: "include" | "exclude";
    term: string;
    isRegex?: boolean;
  }>;
  filterLogic?: "AND" | "OR";
  bucketSize?: string;
  timeRange?: { startDate?: string; endDate?: string };
  notes?: string;
  tags?: string[];
  interestingLines?: number[];
  showOnlyMarked?: boolean;
}

const DB_NAME = "logTrawlerDB";
const DB_VERSION = 1;
const LOG_FILES_STORE = "logFiles";

// Initialize the database
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // First check if the database exists
    const databases = indexedDB.databases
      ? indexedDB.databases()
      : Promise.resolve([]);

    databases
      .then((dbs) => {
        const dbExists = dbs.some((db) => db.name === DB_NAME);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
          reject("Failed to open database");
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object store for log files
          if (!db.objectStoreNames.contains(LOG_FILES_STORE)) {
            const store = db.createObjectStore(LOG_FILES_STORE, {
              keyPath: "id",
            });
            store.createIndex("name", "name", { unique: false });
            store.createIndex("lastOpened", "lastOpened", { unique: false });
          }
        };
      })
      .catch((err) => {
        // Fallback to just opening the database
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
          reject("Failed to open database");
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object store for log files
          if (!db.objectStoreNames.contains(LOG_FILES_STORE)) {
            const store = db.createObjectStore(LOG_FILES_STORE, {
              keyPath: "id",
            });
            store.createIndex("name", "name", { unique: false });
            store.createIndex("lastOpened", "lastOpened", { unique: false });
          }
        };
      });
  });
};

// Save a log file to IndexedDB
export const saveLogFile = async (logFile: LogFileData): Promise<string> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readwrite");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // First check if a file with this name already exists
      const nameIndex = store.index("name");
      const nameRequest = nameIndex.getAll();

      nameRequest.onsuccess = (e) => {
        const existingFiles = (e.target as IDBRequest).result;
        const existingFile = existingFiles.find((f) => f.name === logFile.name);

        if (existingFile) {
          // Use the existing ID to ensure we update rather than create a new entry
          logFile.id = existingFile.id;
        }

        // Convert Date objects to strings for storage
        // Make sure content is included and not undefined
        const fileToStore = {
          ...logFile,
          content: logFile.content || [], // Ensure content is always defined
          lastOpened: Date.now(),
          timeRange: logFile.timeRange
            ? {
                startDate: logFile.timeRange.startDate
                  ? new Date(logFile.timeRange.startDate).toISOString()
                  : undefined,
                endDate: logFile.timeRange.endDate
                  ? new Date(logFile.timeRange.endDate).toISOString()
                  : undefined,
              }
            : undefined,
        };

        const request = store.put(fileToStore);

        request.onsuccess = () => {
          resolve(logFile.id);
        };

        request.onerror = (event) => {
          reject("Failed to save log file");
        };

        transaction.oncomplete = () => {
          db.close();
        };
      };

      nameRequest.onerror = (event) => {
        reject("Failed to check for existing files");
      };
    });
  } catch (error) {
    throw error;
  }
};

// Get all log files from IndexedDB
export const getAllLogFiles = async (): Promise<LogFileData[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readonly");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // Use getAll instead of cursor for more reliable results
      const request = store.getAll();

      request.onsuccess = (event) => {
        const logFiles = (event.target as IDBRequest).result || [];
        // Sort by lastOpened in descending order
        logFiles.sort((a, b) => b.lastOpened - a.lastOpened);
        resolve(logFiles);
      };

      request.onerror = (event) => {
        reject("Failed to get log files");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return [];
  }
};

// Get only metadata for all log files (without content) for faster loading
export const getLogFilesMetadata = async (): Promise<
  (Omit<LogFileData, "content"> & { lines?: number })[]
> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readonly");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // Use getAll with a cursor to only retrieve metadata
      const request = store.openCursor();
      const metadataFiles: Omit<LogFileData, "content">[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          // Extract everything except the content
          const { content, ...metadata } = cursor.value;
          // Add the line count but not the content itself
          metadataFiles.push({
            ...metadata,
            lines: content?.length || 0,
          });
          cursor.continue();
        } else {
          // Sort by lastOpened in descending order
          metadataFiles.sort((a, b) => b.lastOpened - a.lastOpened);
          resolve(metadataFiles);
        }
      };

      request.onerror = (event) => {
        reject("Failed to get log files metadata");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return [];
  }
};

// Get a log file by ID
export const getLogFileById = async (
  id: string,
): Promise<LogFileData | null> => {
  // Validate the ID is not empty
  if (!id || id.trim() === "") {
    return null;
  }
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readonly");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // First try to get all files to see what's in the database
      const allRequest = store.getAll();

      allRequest.onsuccess = (event) => {
        const allFiles = (event.target as IDBRequest).result || [];

        // Now try to get the specific file
        const request = store.get(id);

        request.onsuccess = (event) => {
          const result = (event.target as IDBRequest).result;
          if (result) {
            // Update lastOpened time
            const updateTx = db.transaction([LOG_FILES_STORE], "readwrite");
            const updateStore = updateTx.objectStore(LOG_FILES_STORE);
            result.lastOpened = Date.now();
            updateStore.put(result);
            resolve(result);
          } else {
            // Try with a different ID format (for backward compatibility)
            // Extract the filename from the ID
            const nameParts = id.split("_");
            if (nameParts.length > 1) {
              // Try to extract the actual filename without the timestamp
              const fileName = nameParts[0]; // Just use the first part as the filename

              // Look for any file with a similar name
              const matchingFile = allFiles.find((f) => {
                // Try exact name match
                if (f.name === fileName) return true;

                // Try normalized name match
                const normalizedName = fileName
                  .replace(/[^a-z0-9]/gi, "")
                  .toLowerCase();
                const normalizedFilename = f.name
                  .replace(/[^a-z0-9]/gi, "")
                  .toLowerCase();
                if (normalizedName === normalizedFilename) return true;

                // Try substring match
                return (
                  f.name.toLowerCase().includes(fileName.toLowerCase()) ||
                  fileName.toLowerCase().includes(f.name.toLowerCase())
                );
              });

              if (matchingFile) {
                resolve(matchingFile);
                return;
              }
            }
            resolve(null);
          }
        };

        request.onerror = (event) => {
          reject("Failed to get log file");
        };
      };

      allRequest.onerror = (event) => {
        reject("Failed to get all files");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return null;
  }
};

// Delete a log file by ID
export const deleteLogFile = async (id: string): Promise<boolean> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readwrite");
      const store = transaction.objectStore(LOG_FILES_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        reject("Failed to delete log file");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return false;
  }
};

// Update a log file's filters or other metadata
export const updateLogFile = async (
  id: string,
  updates: Partial<LogFileData>,
): Promise<boolean> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readwrite");
      const store = transaction.objectStore(LOG_FILES_STORE);

      // First get the existing file
      const getRequest = store.get(id);

      getRequest.onsuccess = (event) => {
        const existingFile = (event.target as IDBRequest).result;
        if (!existingFile) {
          reject("Log file not found");
          return;
        }

        // Update the file with new values
        const updatedFile = {
          ...existingFile,
          ...updates,
          lastOpened: Date.now(),
        };

        // Save the updated file
        const putRequest = store.put(updatedFile);

        putRequest.onsuccess = () => {
          resolve(true);
        };

        putRequest.onerror = (event) => {
          reject("Failed to update log file");
        };
      };

      getRequest.onerror = (event) => {
        reject("Failed to get log file for update");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return false;
  }
};

// Reset the database (for troubleshooting)
export const resetDatabase = async (): Promise<boolean> => {
  // Instead of deleting the database, just initialize it if it doesn't exist
  try {
    await initDB();
    return true;
  } catch (error) {
    return false;
  }
};
