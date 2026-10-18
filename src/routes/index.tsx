import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
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

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    messages: [GREETING],
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => {
      const msg = e.message || "";
      setError(
        msg.includes("429")
          ? "Too many requests right now — please wait a moment and try again."
          : msg.includes("402")
            ? "AI credits have run out for this app."
            : "Something went wrong. Please try again.",
      );
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
    sendMessage({ text: t });
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
          <button
            onClick={restart}
            title="Start over"
            aria-label="Start over"
            className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-4" />
          </button>
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
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
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
    </div>
  );
}
