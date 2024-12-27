import React, { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format, parse, set } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TimeRangeFilterProps {
  startDate?: Date;
  endDate?: Date;
  onRangeChange: (start?: Date, end?: Date) => void;
}

const TimeRangeFilter = ({
  startDate,
  endDate,
  onRangeChange,
}: TimeRangeFilterProps) => {
  const [startTime, setStartTime] = useState(
    startDate ? format(startDate, "HH:mm:ss") : "00:00:00",
  );
  const [endTime, setEndTime] = useState(
    endDate ? format(endDate, "HH:mm:ss") : "23:59:59",
  );

  const formatDate = (date?: Date) => {
    if (!date) return "";
    return format(date, "dd-MMM-yyyy HH:mm:ss");
  };

  const handleTimeChange = (timeStr: string, isStart: boolean) => {
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return;

    const date = isStart ? startDate : endDate;
    if (!date) return;

    const newDate = set(date, { hours, minutes, seconds });
    onRangeChange(isStart ? newDate : startDate, isStart ? endDate : newDate);
    if (isStart) setStartTime(timeStr);
    else setEndTime(timeStr);
  };

  const handleDateSelect = (date: Date | undefined, isStart: boolean) => {
    if (!date) {
      onRangeChange(
        isStart ? undefined : startDate,
        isStart ? endDate : undefined,
      );
      return;
    }

    const timeStr = isStart ? startTime : endTime;
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    const newDate = set(date, { hours, minutes, seconds });
    onRangeChange(isStart ? newDate : startDate, isStart ? endDate : newDate);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`justify-start text-left font-normal ${!startDate && "text-muted-foreground"}`}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {startDate ? formatDate(startDate) : "Start date & time"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="flex flex-col gap-4">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => handleDateSelect(date, true)}
              initialFocus
            />
            <Input
              type="time"
              step="1"
              value={startTime}
              onChange={(e) => handleTimeChange(e.target.value, true)}
            />
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`justify-start text-left font-normal ${!endDate && "text-muted-foreground"}`}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {endDate ? formatDate(endDate) : "End date & time"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="flex flex-col gap-4">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => handleDateSelect(date, false)}
              initialFocus
            />
            <Input
              type="time"
              step="1"
              value={endTime}
              onChange={(e) => handleTimeChange(e.target.value, false)}
            />
          </div>
        </PopoverContent>
      </Popover>

      {(startDate || endDate) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onRangeChange(undefined, undefined);
            setStartTime("00:00:00");
            setEndTime("23:59:59");
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default TimeRangeFilter;
