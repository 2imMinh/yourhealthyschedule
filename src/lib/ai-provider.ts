// src/lib/ai-provider.ts
// Provider-agnostic seam for LLM calls. The rest of the app depends on the
// AiProvider interface, never on a vendor SDK directly — so swapping OpenAI for
// Anthropic/Claude (or a local model) is a single new implementation here, with
// zero changes to callers. Domain prompts + output validation live in
// server/services/ai.service.ts; this file is pure transport.

import OpenAI from "openai";

export class AiError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "AiError";
  }
}

export interface GenerateJsonOptions {
  system: string;
  user: string;
  maxTokens?: number;
  /** Low by default for stable, near-deterministic structured output. */
  temperature?: number;
}

export interface AiProvider {
  /** Returns parsed JSON (caller is responsible for schema-validating it). */
  generateJSON(opts: GenerateJsonOptions): Promise<unknown>;
}

class OpenAIProvider implements AiProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Don't throw at import time; the service degrades gracefully if the AI
      // layer is unavailable. We only fail when actually called.
      this.client = new OpenAI({ apiKey: "missing" });
    } else {
      this.client = new OpenAI({ apiKey });
    }
    this.model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  async generateJSON(opts: GenerateJsonOptions): Promise<unknown> {
    if (!process.env.OPENAI_API_KEY) {
      throw new AiError("OPENAI_API_KEY is not configured");
    }
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 512,
        response_format: { type: "json_object" }, // enforce JSON output
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      });
      const text = res.choices[0]?.message?.content ?? "{}";
      return JSON.parse(text);
    } catch (err) {
      throw new AiError("LLM request failed", err);
    }
  }
}

/**
 * App-wide singleton. To switch providers, implement AiProvider (e.g. an
 * AnthropicProvider) and export it here — nothing else changes.
 */
export const aiProvider: AiProvider = new OpenAIProvider();
