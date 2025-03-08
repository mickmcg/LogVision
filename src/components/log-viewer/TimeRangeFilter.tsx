import React, { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, X, Check } from "lucide-react";
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
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(
    startDate,
  );
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(endDate);
  const [startTime, setStartTime] = useState(
    startDate ? format(startDate, "HH:mm:ss") : "00:00:00",
  );
  const [endTime, setEndTime] = useState(
    endDate ? format(endDate, "HH:mm:ss") : "23:59:59",
  );
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  // Update temp dates when props change
  React.useEffect(() => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setStartTime(startDate ? format(startDate, "HH:mm:ss") : "00:00:00");
    setEndTime(endDate ? format(endDate, "HH:mm:ss") : "23:59:59");
  }, [startDate, endDate]);

  const formatDate = (date?: Date) => {
    if (!date) return "";
    return format(date, "dd-MMM-yyyy HH:mm:ss");
  };

  const handleTimeChange = (timeStr: string, isStart: boolean) => {
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return;

    const date = isStart ? tempStartDate : tempEndDate;
    if (!date) return;

    const newDate = set(date, { hours, minutes, seconds });
    if (isStart) {
      setTempStartDate(newDate);
      setStartTime(timeStr);
    } else {
      setTempEndDate(newDate);
      setEndTime(timeStr);
    }
  };

  const handleDateSelect = (date: Date | undefined, isStart: boolean) => {
    if (!date) {
      if (isStart) {
        setTempStartDate(undefined);
      } else {
        setTempEndDate(undefined);
      }
      return;
    }

    const timeStr = isStart ? startTime : endTime;
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    const newDate = set(date, { hours, minutes, seconds });

    if (isStart) {
      setTempStartDate(newDate);
    } else {
      setTempEndDate(newDate);
    }
  };

  const handleApply = (isStart: boolean) => {
    if (isStart) {
      onRangeChange(tempStartDate, endDate);
      setStartOpen(false);
    } else {
      onRangeChange(startDate, tempEndDate);
      setEndOpen(false);
    }
  };

  const handleCancel = (isStart: boolean) => {
    if (isStart) {
      setTempStartDate(startDate);
      setStartTime(startDate ? format(startDate, "HH:mm:ss") : "00:00:00");
      setStartOpen(false);
    } else {
      setTempEndDate(endDate);
      setEndTime(endDate ? format(endDate, "HH:mm:ss") : "23:59:59");
      setEndOpen(false);
    }
  };

  const handleClear = () => {
    onRangeChange(undefined, undefined);
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setStartTime("00:00:00");
    setEndTime("23:59:59");
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={startOpen} onOpenChange={setStartOpen}>
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
              selected={tempStartDate}
              defaultMonth={tempStartDate || startDate}
              onSelect={(date) => handleDateSelect(date, true)}
              initialFocus
            />
            <Input
              type="time"
              step="1"
              value={startTime}
              onChange={(e) => handleTimeChange(e.target.value, true)}
            />
            <div className="flex justify-between gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCancel(true)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleApply(true)}
                className="flex-1"
              >
                <Check className="mr-1 h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={endOpen} onOpenChange={setEndOpen}>
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
              selected={tempEndDate}
              defaultMonth={tempEndDate || endDate}
              onSelect={(date) => handleDateSelect(date, false)}
              initialFocus
            />
            <Input
              type="time"
              step="1"
              value={endTime}
              onChange={(e) => handleTimeChange(e.target.value, false)}
            />
            <div className="flex justify-between gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCancel(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleApply(false)}
                className="flex-1"
              >
                <Check className="mr-1 h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {(startDate || endDate) && (
        <Button variant="ghost" size="icon" onClick={handleClear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default TimeRangeFilter;
