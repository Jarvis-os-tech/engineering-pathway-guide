import { convertToModelMessages, type UIMessage } from "ai";
import { createResponsesCall } from "./responses.ts";

const SYSTEM = `You are "Disha", a warm, trusted AI counsellor helping Indian families decide on engineering education for their child. You talk with parents and students together.

Your job:
- Help choose an engineering branch (CSE, AI/DS, ECE, EEE, Mechanical, Civil, Chemical, Biotech, Aerospace, etc.) and colleges (IITs, NITs, IIITs, BITS, state government colleges, reputed private colleges).
- Explain admissions: JEE Main, JEE Advanced, JoSAA/CSAB counselling, BITSAT, state CETs (MHT-CET, KCET, TS/AP EAMCET, WBJEE, COMEDK, etc.), cut-offs, category/quota, home-state quota, documents and deadlines.
- Explain costs in INR: tuition, hostel, living, total 4-year estimate, scholarships (central/state, merit, fee waivers for family income), education loans (Vidya Lakshmi, bank loans, collateral limits) and ROI/placements.

How you behave:
- Be PROACTIVE. Ask one or two short, focused questions at a time to understand the family: student's interests and strengths, class 12 marks/expected JEE rank or percentile, state and category, budget per year, willingness to relocate, career goals (job, higher studies, abroad, government, startup), and parents' concerns.
- At the start, warmly greet and ask the first question. Always end your reply with a clear next question unless the family asked you to stop.
- Keep replies short and conversational. Use simple English; if the family writes in Hindi or Hinglish, reply the same way.
- When you have enough info, give a clear recommendation with a shortlist (safe / moderate / ambitious), reasons, estimated costs, and next steps with timelines.
- Balance the student's passion and the parents' practical concerns respectfully. Never pressure.
- Cut-offs and fees change every year: give realistic ranges and remind them to verify on official sites (josaa.nic.in, college sites) for current numbers.

Guided decision journey (follow it, adapting to answers):
1. Profile — who is talking, class, marks / expected JEE or CET rank, state, category.
2. Interests — subjects enjoyed, strengths, career dreams; resolve any student–parent disagreement.
3. Branch — suggest 2–3 fitting branches with why; ask which feels right.
4. Budget — yearly budget, loan/scholarship openness, family income bracket (for fee waivers).
5. Colleges — location preference, then a safe / moderate / ambitious shortlist.
6. Admission plan — exams, counselling rounds, dates, documents, and a final action checklist.
Each NEXT question must follow from the family's last answer and the decision just made. Never ask something already answered. Briefly reflect what you learned before asking.

FORMAT RULE (mandatory): end EVERY reply with exactly these two lines on their own:
STAGE: <number 1-6 of the current step>
OPTIONS: <2-4 short tap-able answers to your question, separated by " | ">`;

export async function handleChat(request: Request) {
  // Read API keys from process.env (supports Gemini, OpenAI, Lovable, and NEXT_PUBLIC_* conventions)
  const clientKey =
    request.headers.get("x-api-key") ||
    request.headers.get("x-gemini-api-key") ||
    request.headers.get("x-openai-api-key") ||
    undefined;

  const geminiKey =
    clientKey ||
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"] ||
    process.env["NEXT_PUBLIC_GEMINI_API_KEY"];

  const openAiKey =
    clientKey ||
    process.env["OPENAI_API_KEY"] ||
    process.env["NEXT_PUBLIC_OPENAI_API_KEY"];

  const lovableKey =
    process.env["LOVABLE_API_KEY"] ||
    process.env["NEXT_PUBLIC_LOVABLE_API_KEY"];

  const genericKey =
    clientKey ||
    process.env["NEXT_PUBLIC_API_KEY"] ||
    process.env["API_KEY"];

  // Determine provider from explicit env or available keys
  const requestedProvider = (process.env["AI_PROVIDER"] || "").toLowerCase();

  let resolvedProvider: "gemini" | "openai" | "lovable" | null = null;
  let resolvedKey = "";

  if (requestedProvider === "gemini" && (geminiKey || genericKey)) {
    resolvedProvider = "gemini";
    resolvedKey = (geminiKey || genericKey)!;
  } else if (requestedProvider === "openai" && (openAiKey || genericKey)) {
    resolvedProvider = "openai";
    resolvedKey = (openAiKey || genericKey)!;
  } else if (requestedProvider === "lovable" && (lovableKey || genericKey)) {
    resolvedProvider = "lovable";
    resolvedKey = (lovableKey || genericKey)!;
  } else if (geminiKey) {
    resolvedProvider = "gemini";
    resolvedKey = geminiKey;
  } else if (openAiKey) {
    resolvedProvider = "openai";
    resolvedKey = openAiKey;
  } else if (lovableKey) {
    resolvedProvider = "lovable";
    resolvedKey = lovableKey;
  } else if (genericKey) {
    // Detect provider from key format (Gemini keys commonly start with AIzaSy; OpenAI with sk-)
    if (genericKey.startsWith("AIzaSy")) {
      resolvedProvider = "gemini";
      resolvedKey = genericKey;
    } else {
      resolvedProvider = "openai";
      resolvedKey = genericKey;
    }
  }

  if (!resolvedProvider || !resolvedKey) {
    return Response.json(
      {
        error:
          "AI API key is missing. Please add GEMINI_API_KEY, OPENAI_API_KEY, or NEXT_PUBLIC_API_KEY in your Vercel Project Settings (Settings > Environment Variables) or .env file.",
      },
      { status: 500 },
    );
  }

  let body: { messages?: UIMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const maxHistory = Number(process.env["CHAT_MAX_MESSAGES"]) || 60;
  const messages = Array.isArray(body.messages) ? body.messages.slice(-maxHistory) : [];

  let config: {
    baseURL: string;
    apiKey: string;
    model: string;
    isGemini?: boolean;
    isOpenAI?: boolean;
  };

  if (resolvedProvider === "gemini") {
    config = {
      baseURL:
        process.env["GEMINI_BASE_URL"] ||
        "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: resolvedKey,
      model: process.env["GEMINI_MODEL"] || "gemini-2.5-flash",
      isGemini: true,
    };
  } else if (resolvedProvider === "openai") {
    config = {
      baseURL: process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1",
      apiKey: resolvedKey,
      model: process.env["OPENAI_MODEL"] || "gpt-4o",
      isOpenAI: true,
    };
  } else {
    config = {
      baseURL: process.env["LOVABLE_BASE_URL"] || "https://ai.gateway.lovable.dev/v1",
      apiKey: resolvedKey,
      model: process.env["LOVABLE_MODEL"] || "openai/gpt-6-astra",
      isGemini: false,
    };
  }

  const call = createResponsesCall(
    request,
    config,
    await convertToModelMessages(messages),
    SYSTEM,
  );
  return call.response();
}
