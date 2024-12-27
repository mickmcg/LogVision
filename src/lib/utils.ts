import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { parse, isValid } from "date-fns";
import { parseISO } from "date-fns";

const includeColors = [
  {
    bg: "bg-blue-500",
    text: "text-white",
    highlight: "bg-blue-100 text-blue-700",
  },
  {
    bg: "bg-green-500",
    text: "text-white",
    highlight: "bg-green-100 text-green-700",
  },
  {
    bg: "bg-purple-500",
    text: "text-white",
    highlight: "bg-purple-100 text-purple-700",
  },
  {
    bg: "bg-orange-500",
    text: "text-white",
    highlight: "bg-orange-100 text-orange-700",
  },
  {
    bg: "bg-cyan-500",
    text: "text-white",
    highlight: "bg-cyan-100 text-cyan-700",
  },
];

const excludeColors = [
  {
    bg: "bg-red-500",
    text: "text-white",
    highlight: "bg-red-100 text-red-700",
  },
  {
    bg: "bg-pink-500",
    text: "text-white",
    highlight: "bg-pink-100 text-pink-700",
  },
  {
    bg: "bg-rose-500",
    text: "text-white",
    highlight: "bg-rose-100 text-rose-700",
  },
  {
    bg: "bg-fuchsia-500",
    text: "text-white",
    highlight: "bg-fuchsia-100 text-fuchsia-700",
  },
  {
    bg: "bg-amber-500",
    text: "text-white",
    highlight: "bg-amber-100 text-amber-700",
  },
];

export interface ParsedLogLine {
  timestamp: string;
  message: string;
}

const DATE_FORMATS = [
  "yyyy-MM-dd HH:mm:ss", // 2024-12-12 01:48:36
  "dd-MMM-yyyy HH:mm:ss.SSS", // 25-Dec-2024 00:00:06.596
  "yyyy-MM-dd'T'HH:mm:ss.SSSX", // ISO format
  "yyyy-MM-dd'T'HH:mm:ssX", // ISO format without ms
  "MM/dd/yyyy HH:mm:ss", // American format
  "dd/MM/yyyy HH:mm:ss", // European format
  "yyyy.MM.dd HH:mm:ss", // Dot separated
];

const tryParseDate = (timestamp: string, format: string): Date | null => {
  try {
    const date = parse(timestamp, format, new Date());
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
};

export const parseLogLine = (line: string): ParsedLogLine => {
  // Skip empty lines
  if (!line.trim()) {
    return {
      timestamp: "-",
      message: line,
    };
  }

  // Match various timestamp formats
  const timestampRegex =
    /(\d{4}-\d{2}-\d{2}(?:[T\s])\d{1,2}:\d{2}:\d{2}(?:\.\d{3})?(?:[Z])?|\d{2}[-/](?:[A-Za-z]+|\d{2})[-/]\d{4}\s\d{1,2}:\d{2}:\d{2}(?:\.\d{3})?)/;
  const match = line.match(timestampRegex);

  if (match) {
    const timestamp = match[1];
    return {
      timestamp,
      message: line,
    };
  }

  return {
    timestamp: "-",
    message: line,
  };
};

export const parseTimestamp = (timestamp: string): Date | undefined => {
  try {
    if (timestamp === "-") return undefined;

    // Try ISO format first
    try {
      const isoDate = parseISO(timestamp);
      if (isValid(isoDate)) return isoDate;
    } catch {}

    // Try each format until one works
    for (const format of DATE_FORMATS) {
      const date = tryParseDate(timestamp, format);
      if (date) return date;
    }

    return undefined;
  } catch (error) {
    console.error("Error parsing timestamp:", error);
    return undefined;
  }
};

export const getFilterColor = (type: "include" | "exclude", index: number) => {
  const colors = type === "include" ? includeColors : excludeColors;
  return colors[index % colors.length];
};

export const getFilterIndex = (filters: any[], id: string) => {
  const typeFilters = filters.filter(
    (f) => f.type === filters.find((filter) => filter.id === id)?.type,
  );
  return typeFilters.findIndex((f) => f.id === id);
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
