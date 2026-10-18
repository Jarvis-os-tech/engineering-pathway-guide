import { describe, it, expect } from "vitest";
import { resolveAiConfig } from "@/lib/ai/chat.server";

describe("resolveAiConfig", () => {
  it("resolves NEXT_PUBLIC_API_KEY as Google Gemini provider", () => {
    const config = resolveAiConfig({
      env: {
        NEXT_PUBLIC_API_KEY: "test-gemini-key-123",
      },
    });

    expect(config).not.toBeNull();
    expect(config?.provider).toBe("gemini");
    expect(config?.apiKey).toBe("test-gemini-key-123");
    expect(config?.isGemini).toBe(true);
    expect(config?.model).toBe("gemini-2.5-flash");
    expect(config?.baseURL).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    );
  });

  it("respects GEMINI_MODEL override", () => {
    const config = resolveAiConfig({
      env: {
        NEXT_PUBLIC_API_KEY: "test-gemini-key-123",
        GEMINI_MODEL: "gemini-2.0-flash",
      },
    });

    expect(config?.model).toBe("gemini-2.0-flash");
  });

  it("resolves dedicated GEMINI_API_KEY and NEXT_PUBLIC_GEMINI_API_KEY", () => {
    const config1 = resolveAiConfig({
      env: {
        GEMINI_API_KEY: "dedicated-gemini-key",
      },
    });
    expect(config1?.provider).toBe("gemini");
    expect(config1?.apiKey).toBe("dedicated-gemini-key");

    const config2 = resolveAiConfig({
      env: {
        NEXT_PUBLIC_GEMINI_API_KEY: "public-gemini-key",
      },
    });
    expect(config2?.provider).toBe("gemini");
    expect(config2?.apiKey).toBe("public-gemini-key");
  });

  it("resolves OPENAI_API_KEY as openai provider", () => {
    const config = resolveAiConfig({
      env: {
        OPENAI_API_KEY: "sk-test-openai-key",
      },
    });

    expect(config?.provider).toBe("openai");
    expect(config?.apiKey).toBe("sk-test-openai-key");
    expect(config?.isOpenAI).toBe(true);
    expect(config?.model).toBe("gpt-4o");
  });

  it("returns null when no keys are provided", () => {
    const config = resolveAiConfig({
      env: {},
    });

    expect(config).toBeNull();
  });

  it("allows clientKey from header or body to override or provide the key", () => {
    const config = resolveAiConfig({
      clientKey: "client-provided-gemini-key",
      env: {},
    });

    expect(config?.provider).toBe("gemini");
    expect(config?.apiKey).toBe("client-provided-gemini-key");
  });
});
