import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  // Function to set chat panel open state from outside
  const setChatPanelOpen = (open: boolean) => {
    if (open && !isOpen) {
      // Create a custom event to notify parent component
      const event = new CustomEvent("setChatPanelOpen", { detail: { open } });
      document.dispatchEvent(event);
    }
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem("openai_api_key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    // Listen for custom event to open chat with a prompt
    const handleOpenChatWithPrompt = (
      event: CustomEvent<{ prompt: string }>,
    ) => {
      setChatPanelOpen(true);
      setInput(event.detail.prompt);

      // Auto-submit the question after a short delay to ensure the panel is open
      setTimeout(() => {
        if (apiKey && event.detail.prompt) {
          const userMessage: Message = {
            role: "user",
            content: event.detail.prompt,
          };
          setMessages((prev) => [...prev, userMessage]);
          setIsLoading(true);

          fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [...messages, userMessage],
              temperature: 0.7,
            }),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              const assistantMessage: Message = {
                role: "assistant",
                content: data.choices[0].message.content,
              };
              setMessages((prev) => [...prev, assistantMessage]);
            })
            .catch((error) => {
              console.error("Error calling OpenAI API:", error);
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    "Sorry, there was an error processing your request. Please check your API key and try again.",
                },
              ]);
            })
            .finally(() => {
              setIsLoading(false);
              setInput("");
            });
        }
      }, 300);
    };

    // Add event listener
    document.addEventListener(
      "openChatWithPrompt",
      handleOpenChatWithPrompt as EventListener,
    );

    // Clean up
    return () => {
      document.removeEventListener(
        "openChatWithPrompt",
        handleOpenChatWithPrompt as EventListener,
      );
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveApiKey = () => {
    localStorage.setItem("openai_api_key", apiKey);
    setSettingsOpen(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !apiKey) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [...messages, userMessage],
            temperature: 0.7,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.choices[0].message.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, there was an error processing your request. Please check your API key and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[450px] bg-background border-l shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="font-medium">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              className="text-xs"
              disabled={messages.length === 0}
            >
              Clear History
            </Button>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>API Settings</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="api-key">OpenAI API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Your API key is stored locally and never sent to our
                      servers.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={saveApiKey}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                <Bot className="h-8 w-8 mb-2" />
                <p>Ask me anything about your log files!</p>
                <p className="text-xs mt-2">
                  {apiKey
                    ? "Type a message to start the conversation"
                    : "Please set your OpenAI API key in settings first"}
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          {!apiKey ? (
            <Button
              className="w-full"
              onClick={() => setSettingsOpen(true)}
              variant="outline"
            >
              Set API Key to Start
            </Button>
          ) : (
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button
                className="self-end"
                size="icon"
                disabled={isLoading || !input.trim()}
                onClick={sendMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
