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
}

const DB_NAME = "logTrawlerDB";
const DB_VERSION = 1;
const LOG_FILES_STORE = "logFiles";

// Initialize the database
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
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
        const store = db.createObjectStore(LOG_FILES_STORE, { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("lastOpened", "lastOpened", { unique: false });
      }
    };
  });
};

// Save a log file to IndexedDB
export const saveLogFile = async (logFile: LogFileData): Promise<string> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readwrite");
      const store = transaction.objectStore(LOG_FILES_STORE);

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
        resolve(logFile.id);
      };

      request.onerror = (event) => {
        console.error("Error saving log file:", event);
        reject("Failed to save log file");
      };

      transaction.oncomplete = () => {
        db.close();
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
      const index = store.index("lastOpened");

      const request = index.openCursor(null, "prev"); // Sort by lastOpened in descending order
      const logFiles: LogFileData[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          logFiles.push(cursor.value);
          cursor.continue();
        } else {
          resolve(logFiles);
        }
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
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOG_FILES_STORE], "readonly");
      const store = transaction.objectStore(LOG_FILES_STORE);
      const request = store.get(id);

      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        if (result) {
          // Update lastOpened time
          const updateTx = db.transaction([LOG_FILES_STORE], "readwrite");
          const updateStore = updateTx.objectStore(LOG_FILES_STORE);
          result.lastOpened = Date.now();
          updateStore.put(result);
        }
        resolve(result || null);
      };

      request.onerror = (event) => {
        console.error("Error getting log file:", event);
        reject("Failed to get log file");
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
