import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.ts";

export function createResponsesCall(
  request: Request,
  config: { baseURL: string; apiKey: string; model: string; isGemini?: boolean; isOpenAI?: boolean },
  messages: ModelMessage[],
  instructions?: string,
) {
  if (config.isGemini || config.isOpenAI) {
    const provider = createOpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    const result = streamText({
      model: provider.chat(config.model),
      ...(instructions ? { system: instructions } : {}),
      messages,
      abortSignal: request.signal,
    });
    return {
      result,
      response: () =>
        result.toUIMessageStreamResponse({
          onError: (err) => {
            const raw = err instanceof Error ? err.message : String(err);
            console.error("AI Generation Error:", raw);
            if (
              raw.includes("400") ||
              raw.includes("Please pass a valid API key") ||
              raw.includes("API key not valid") ||
              raw.includes("INVALID_ARGUMENT")
            ) {
              return "Invalid API key. Please check your Google Gemini API key via the 'Add API Key' button in the header.";
            }
            if (raw.includes("404") || raw.includes("not found")) {
              return `AI model '${config.model}' is not accessible with this API key. Try switching to gemini-2.0-flash or gemini-1.5-flash.`;
            }
            if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota")) {
              return "Gemini API rate limit or quota exceeded. Please wait a moment or try again later.";
            }
            return raw || "An error occurred during AI generation.";
          },
        }),
    };
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const reasoning = config.model !== "openai/chat-latest";
  const result = streamText({
    model: provider.responses(config.model),
    ...(instructions ? { instructions } : {}),
    messages,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        ...(reasoning
          ? {
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            }
          : {}),
      },
    },
  });
  return {
    result,
    response: () =>
      withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse({ sendReasoning: true }), runIdFetch),
  };
}
