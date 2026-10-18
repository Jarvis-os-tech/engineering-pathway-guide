import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useState } from "react";
import { RotateCcw, Key } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Loader } from "@/components/ai-elements/loader";
import logo from "@/assets/disha-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Disha — AI Engineering Admission Counsellor for Families" },
      {
        name: "description",
        content:
          "Type with an AI counsellor to choose the right engineering branch and college in India, plan admissions, and manage costs.",
      },
      { property: "og:title", content: "Disha — AI Engineering Counsellor for Families" },
      {
        property: "og:description",
        content: "Chat guidance on branches, colleges, JEE/CET admissions and costs in India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const GREETING: UIMessage = {
  id: "greet",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Namaste! I'm **Disha**, your family's engineering admission guide. 🙏\n\nI'll help you choose the right **branch and college**, understand **admissions** (JEE, JoSAA, state CETs) and plan **costs, scholarships and loans**.\n\nTo begin — who is with me today, and which class is the student in (or what is their expected JEE rank / board percentage)?\nSTAGE: 1\nOPTIONS: Parent and student together | Class 12, JEE coming up | Class 12 results are out | Just exploring options",
    },
  ],
};

const STAGES = ["Profile", "Interests", "Branch", "Budget", "Colleges", "Admission plan"];

// Splits the assistant's trailing "STAGE:" / "OPTIONS:" lines from the visible answer.
export function parseReply(raw: string) {
  let stage: number | null = null;
  let options: string[] = [];
  const body = raw
    .split("\n")
    .filter((line) => {
      const st = line.match(/^\s*\**STAGE:?\**\s*(\d)/i);
      if (st) { stage = Number(st[1]); return false; }
      const op = line.match(/^\s*\**OPTIONS:?\**\s*(.*)$/i);
      if (op) { options = (op[1] ?? "").split("|").map((o) => o.trim()).filter(Boolean).slice(0, 4); return false; }
      return true;
    })
    .join("\n")
    .trimEnd();
  return { body, stage: stage as number | null, options };
}

function Index() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [tempKey, setTempKey] = useState("");

  const getPublicApiKey = () => {
    if (typeof process !== "undefined" && process.env) {
      return (
        process.env.NEXT_PUBLIC_API_KEY ||
        process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
        process.env.VITE_API_KEY ||
        process.env.VITE_GEMINI_API_KEY ||
        ""
      );
    }
    return "";
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const publicEnvKey = getPublicApiKey();
      const saved = localStorage.getItem("disha_user_api_key") || publicEnvKey || "";
      setUserApiKey(saved);
      setTempKey(saved);
    }
  }, []);

  const saveApiKey = (key: string) => {
    const clean = key.trim();
    setUserApiKey(clean);
    if (typeof window !== "undefined") {
      if (clean) {
        localStorage.setItem("disha_user_api_key", clean);
      } else {
        localStorage.removeItem("disha_user_api_key");
      }
    }
  };

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    messages: [GREETING],
    transport: new DefaultChatTransport({
      api:
        (typeof process !== "undefined" &&
          (process.env.NEXT_PUBLIC_CHAT_API_URL || process.env.VITE_CHAT_API_URL)) ||
        "/api/chat",
      headers: () => {
        const publicEnvKey = getPublicApiKey();
        const saved =
          typeof window !== "undefined"
            ? localStorage.getItem("disha_user_api_key") || publicEnvKey
            : publicEnvKey;
        return saved ? { "x-api-key": saved } : {};
      },
    }),
    onError: (e) => {
      const msg = e.message || "";
      if (
        msg.includes("429") ||
        msg.toLowerCase().includes("quota") ||
        msg.toLowerCase().includes("resource_exhausted")
      ) {
        setError("Gemini rate limit or quota exceeded. Please wait a moment or enter another API key.");
      } else if (msg.includes("402")) {
        setError("AI credits have run out for this app.");
      } else if (
        msg.toLowerCase().includes("valid api key") ||
        msg.toLowerCase().includes("invalid api key")
      ) {
        setError("Invalid Google Gemini API key. Please click below to configure a valid key.");
      } else if (
        msg === "An error occurred." ||
        msg.toLowerCase().includes("error occurred")
      ) {
        setError("Could not connect to Gemini API. Please click below to configure or re-enter your API key.");
      } else {
        setError(msg || "Something went wrong. Please check your API key configuration.");
      }
    },
  });

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastParsed = lastAssistant
    ? parseReply(lastAssistant.parts.map((p) => (p.type === "text" ? p.text : "")).join(""))
    : null;
  const stage =
    messages.reduce<number>((acc, m) => {
      if (m.role !== "assistant") return acc;
      const st = parseReply(m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")).stage;
      return st ?? acc;
    }, 1);

  const busy = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    const publicEnvKey = getPublicApiKey();
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("disha_user_api_key") || publicEnvKey
        : publicEnvKey;
    sendMessage(
      { text: t },
      saved ? { headers: { "x-api-key": saved } } : undefined,
    );
    setInput("");
  };

  const restart = () => {
    stop();
    setMessages([GREETING]);
    setError(null);
  };

  useEffect(() => {
    document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }, [status]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src={logo} alt="Disha logo" className="size-10" width={40} height={40} />
          <div className="flex-1">
            <h1 className="font-display text-xl font-semibold leading-tight text-foreground">Disha</h1>
            <p className="text-xs text-muted-foreground">Engineering admission counsellor for Indian families</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={restart}
              title="Start over"
              aria-label="Start over"
              className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <nav aria-label="Decision progress" className="border-b border-border bg-muted/60">
        <ol className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 py-2 text-xs">
          {STAGES.map((name, i) => {
            const n = i + 1;
            const state = n < stage ? "done" : n === stage ? "now" : "next";
            return (
              <li
                key={name}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${
                  state === "now"
                    ? "bg-primary text-primary-foreground"
                    : state === "done"
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground"
                }`}
              >
                <span className="font-semibold">{state === "done" ? "✓" : n}</span> {name}
              </li>
            );
          })}
        </ol>
      </nav>

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4">
          {messages.map((m) => (
            <Message from={m.role} key={m.id}>
              <MessageContent>
                {m.parts.map((p, i) =>
                  p.type === "text" ? (
                    m.role === "assistant" ? (
                      <MessageResponse key={i}>{parseReply(p.text).body}</MessageResponse>
                    ) : (
                      <span key={i}>{p.text}</span>
                    )
                  ) : null,
                )}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader /> Disha is thinking…
            </div>
          )}
          {!busy && lastParsed && lastParsed.options.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Suggested answers">
              {lastParsed.options.map((o) => (
                <button
                  key={o}
                  onClick={() => send(o)}
                  className="rounded-full border border-primary/40 bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">{error}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTempKey(userApiKey);
                    setApiKeyModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  <Key className="size-3.5" /> Configure Gemini API Key
                </button>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background/60 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-background transition-colors"
                >
                  Get Free Gemini Key ↗
                </a>
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background/60 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-background transition-colors"
                >
                  Open Vercel Settings ↗
                </a>
              </div>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <PromptInput
          onSubmit={(msg) => {
            if (busy) {
              stop();
              return;
            }
            send(msg.text ?? input);
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Disha about branches, colleges, admissions, or fees…"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <div />
            <PromptInputSubmit status={status} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Nothing is saved — this conversation clears when you close the page. Verify cut-offs and fees on official sites.
        </p>
      </div>

      {/* API Key Configuration Modal */}
      <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-5 text-primary" />
              Configure Google Gemini API Key
            </DialogTitle>
            <DialogDescription>
              Enter your Google Gemini API key (or OpenAI key). Public API key = Google Gemini API key (NEXT_PUBLIC_API_KEY).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                Google Gemini API Key (NEXT_PUBLIC_API_KEY)
              </label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="AIzaSy... (Gemini) or sk-... (OpenAI)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Get a free Gemini API key at{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline hover:opacity-80"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            <div className="rounded-md bg-muted/60 p-3 text-xs space-y-1.5 text-muted-foreground">
              <p className="font-semibold text-foreground">💡 Prefer setting it server-wide on Vercel?</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Go to Vercel Project ➔ <strong>Settings</strong> ➔ <strong>Environment Variables</strong></li>
                <li>Add variable: <code className="text-foreground">NEXT_PUBLIC_API_KEY</code> with your Gemini key</li>
                <li>Go to <strong>Deployments</strong> ➔ click <code>...</code> on latest deployment ➔ <strong>Redeploy</strong></li>
              </ol>
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 sm:justify-between">
            {userApiKey ? (
              <button
                type="button"
                onClick={() => {
                  saveApiKey("");
                  setTempKey("");
                  setApiKeyModalOpen(false);
                }}
                className="text-xs text-destructive hover:underline"
              >
                Clear Saved Key
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApiKeyModalOpen(false)}
                className="rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  saveApiKey(tempKey);
                  setApiKeyModalOpen(false);
                  setError(null);
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save Key
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
