import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, RotateCcw, Volume2, VolumeX, Square } from "lucide-react";
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
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Loader } from "@/components/ai-elements/loader";
import { useVoice } from "@/hooks/use-voice";
import logo from "@/assets/disha-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Disha — AI Engineering Admission Counsellor for Families" },
      {
        name: "description",
        content:
          "Talk or type with an AI counsellor to choose the right engineering branch and college in India, plan admissions, and manage costs.",
      },
      { property: "og:title", content: "Disha — AI Engineering Counsellor for Families" },
      {
        property: "og:description",
        content: "Voice + chat guidance on branches, colleges, JEE/CET admissions and costs in India.",
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

const STARTERS = [
  "CSE or ECE — which is better for my child?",
  "Expected JEE Main percentile 92, which NITs are possible?",
  "Our budget is ₹3 lakh per year. What are our options?",
  "How do education loans and scholarships work?",
];

const LANGS = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
];

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
      if (op) { options = op[1].split("|").map((o) => o.trim()).filter(Boolean).slice(0, 4); return false; }
      return true;
    })
    .join("\n")
    .trimEnd();
  return { body, stage: stage as number | null, options };
}

function textOf(m: UIMessage) {
  return parseReply(m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")).body;
}

function Index() {
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [voiceMode, setVoiceMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voice = useVoice(lang);
  const voiceModeRef = useRef(voiceMode);
  voiceModeRef.current = voiceMode;

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
    onFinish: ({ message }) => {
      if (voiceModeRef.current) {
        voice.speak(textOf(message), () => {
          if (voiceModeRef.current) startListening();
        });
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
    voice.stopSpeaking();
    sendMessage({ text: t });
    setInput("");
  };

  const startListening = () => voice.listen((final) => send(final), (interim) => setInput(interim));

  const toggleMic = () => {
    if (voice.listening) voice.stopListening();
    else startListening();
  };

  const toggleVoiceMode = () => {
    const next = !voiceMode;
    setVoiceMode(next);
    if (next) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && !busy) voice.speak(textOf(last), () => startListening());
      else if (!busy) startListening();
    } else {
      voice.stopSpeaking();
      voice.stopListening();
    }
  };

  const restart = () => {
    stop();
    voice.stopSpeaking();
    voice.stopListening();
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
          <select
            aria-label="Voice language"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            onClick={toggleVoiceMode}
            disabled={!voice.supported.speak}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              voiceMode ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
            aria-pressed={voiceMode}
          >
            {voiceMode ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            <span className="hidden sm:inline">Voice talk</span>
          </button>
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
          {!busy && messages.length > 1 && lastParsed && lastParsed.options.length > 0 && (
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
          {messages.length === 1 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm text-card-foreground transition-colors hover:border-primary hover:bg-accent"
                >
                  {s}
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
        {(voice.listening || voice.speaking) && (
          <div className="mb-2 flex items-center justify-center gap-2 text-sm text-primary">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            {voice.listening ? "Listening… speak now" : "Disha is speaking"}
            {voice.speaking && (
              <button onClick={voice.stopSpeaking} className="ml-2 inline-flex items-center gap-1 underline">
                <Square className="size-3" /> Stop
              </button>
            )}
          </div>
        )}
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
              placeholder="Type or tap the mic to talk with Disha…"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton
                onClick={toggleMic}
                disabled={!voice.supported.listen}
                variant={voice.listening ? "default" : "ghost"}
                aria-label={voice.listening ? "Stop listening" : "Speak"}
                title={voice.supported.listen ? "Speak" : "Voice input isn't supported in this browser"}
              >
                {voice.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                <span>{voice.listening ? "Stop" : "Speak"}</span>
              </PromptInputButton>
            </PromptInputTools>
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
