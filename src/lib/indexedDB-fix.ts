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
        console.log(`Database ${DB_NAME} exists: ${dbExists}`);

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
          console.error("IndexedDB error:", event);
          reject("Failed to open database");
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          console.log(`Successfully opened database ${DB_NAME}`);
          resolve(db);
        };

        request.onupgradeneeded = (event) => {
          console.log(`Upgrading database ${DB_NAME} to version ${DB_VERSION}`);
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object store for log files
          if (!db.objectStoreNames.contains(LOG_FILES_STORE)) {
            console.log(`Creating object store ${LOG_FILES_STORE}`);
            const store = db.createObjectStore(LOG_FILES_STORE, {
              keyPath: "id",
            });
            store.createIndex("name", "name", { unique: false });
            store.createIndex("lastOpened", "lastOpened", { unique: false });
            console.log(`Created object store ${LOG_FILES_STORE}`);
          }
        };
      })
      .catch((err) => {
        console.error("Error checking databases:", err);
        // Fallback to just opening the database
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
          console.error("IndexedDB error:", event);
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
  console.log("Saving log file with ID:", logFile.id);
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
        console.log(
          `Found ${existingFiles.length} existing files with name index`,
        );

        const existingFile = existingFiles.find((f) => f.name === logFile.name);

        if (existingFile) {
          console.log(
            "Found existing file with same name, updating ID to match:",
            existingFile.id,
          );
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

        console.log(
          "Saving file to IndexedDB:",
          fileToStore.id,
          fileToStore.name,
          "Content length:",
          fileToStore.content.length,
        );

        const request = store.put(fileToStore);

        request.onsuccess = () => {
          console.log(`Successfully saved file ${fileToStore.id} to IndexedDB`);
          resolve(logFile.id);
        };

        request.onerror = (event) => {
          console.error("Error saving log file:", event);
          reject("Failed to save log file");
        };

        transaction.oncomplete = () => {
          db.close();
        };
      };

      nameRequest.onerror = (event) => {
        console.error("Error checking for existing files:", event);
        reject("Failed to check for existing files");
      };
    });
  } catch (error) {
    console.error("Error in saveLogFile:", error);
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
        console.log(
          "Retrieved all files from IndexedDB:",
          logFiles.length,
          "files",
        );
        resolve(logFiles);
      };

      request.onerror = (event) => {
        console.error("Error getting log files:", event);
        reject("Failed to get log files");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error("Error in getAllLogFiles:", error);
    return [];
  }
};

// Get a log file by ID
export const getLogFileById = async (
  id: string,
): Promise<LogFileData | null> => {
  console.log("Getting log file by ID:", id);

  // Validate the ID is not empty
  if (!id || id.trim() === "") {
    console.error("Invalid ID provided to getLogFileById");
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
        console.log(
          `Database contains ${allFiles.length} files:`,
          allFiles.map((f) => ({ id: f.id, name: f.name })),
        );

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

            // Log the result for debugging
            console.log(
              "Found file in IndexedDB:",
              result.id,
              result.name,
              "Content:",
              result.content?.length || 0,
            );
            resolve(result);
          } else {
            console.log(
              `File with ID ${id} not found directly, trying alternative lookups`,
            );

            // Try with a different ID format (for backward compatibility)
            // Extract the filename from the ID
            const nameParts = id.split("_");
            if (nameParts.length > 1) {
              // Try to extract the actual filename without the timestamp
              const fileName = nameParts[0]; // Just use the first part as the filename
              console.log("Trying alternative lookup with filename:", fileName);

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
                console.log(
                  "Found file by name:",
                  matchingFile.id,
                  matchingFile.name,
                );
                resolve(matchingFile);
                return;
              }
            }

            console.log("File not found in IndexedDB after all attempts");
            resolve(null);
          }
        };

        request.onerror = (event) => {
          console.error("Error getting log file:", event);
          reject("Failed to get log file");
        };
      };

      allRequest.onerror = (event) => {
        console.error("Error getting all files:", event);
        reject("Failed to get all files");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error("Error in getLogFileById:", error);
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
        console.error("Error deleting log file:", event);
        reject("Failed to delete log file");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error("Error in deleteLogFile:", error);
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
          console.error("Error updating log file:", event);
          reject("Failed to update log file");
        };
      };

      getRequest.onerror = (event) => {
        console.error("Error getting log file for update:", event);
        reject("Failed to get log file for update");
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error("Error in updateLogFile:", error);
    return false;
  }
};

// Reset the database (for troubleshooting)
export const resetDatabase = async (): Promise<boolean> => {
  console.warn(
    "DISABLED: resetDatabase was called but is now disabled to prevent data loss",
  );
  // Instead of deleting the database, just initialize it if it doesn't exist
  try {
    await initDB();
    return true;
  } catch (error) {
    console.error(`Error in resetDatabase:`, error);
    return false;
  }
};
