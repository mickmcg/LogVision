import React, { useState } from "react";
import { Search, Plus, Minus, Code } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SearchBarProps {
  onSearch?: (term: string, isRegex?: boolean) => void;
  onAddInclude?: (term: string, isRegex?: boolean) => void;
  onAddExclude?: (term: string, isRegex?: boolean) => void;
  searchTerm?: string;
  isRegex?: boolean;
}

const SearchBar = ({
  onSearch = () => {},
  onAddInclude = () => {},
  onAddExclude = () => {},
  searchTerm = "",
  isRegex: initialIsRegex = false,
}: SearchBarProps) => {
  const [isRegex, setIsRegex] = useState(initialIsRegex);
  return (
    <div className="w-full h-16 px-4 flex items-center gap-2 bg-background border-b">
      <div className="flex-1 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            className="w-full pl-10"
            placeholder={
              isRegex ? "Search with regex pattern..." : "Search logs..."
            }
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value, isRegex)}
          />
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => onAddInclude(searchTerm, isRegex)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add include filter</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onAddExclude(searchTerm, isRegex)}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add exclude filter</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isRegex}
                  onCheckedChange={(checked) => {
                    setIsRegex(checked);
                    if (searchTerm) {
                      onSearch(searchTerm, checked);
                    }
                  }}
                  id="regex-mode"
                />
                <label
                  htmlFor="regex-mode"
                  className="text-sm cursor-pointer flex items-center gap-1"
                >
                  <Code className="h-3.5 w-3.5" />
                  Regex
                </label>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enable regular expression search</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default SearchBar;
