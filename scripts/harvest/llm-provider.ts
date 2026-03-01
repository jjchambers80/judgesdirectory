/**
 * LLM provider abstraction — supports OpenAI and Anthropic with configurable models.
 *
 * Configuration via environment variables:
 *   LLM_PROVIDER=openai|anthropic (default: openai)
 *   LLM_MODEL=gpt-4o-mini|gpt-4.1-mini|claude-haiku-3-5-20241022|... (auto-detected)
 *   OPENAI_API_KEY=sk-...
 *   ANTHROPIC_API_KEY=sk-ant-...
 *
 * @module scripts/harvest/llm-provider
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LLMProvider = "openai" | "anthropic";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

// ---------------------------------------------------------------------------
// Default models by provider (cheapest good options)
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-3-5-20241022",
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI(); // reads OPENAI_API_KEY from env
  }
  return openaiClient;
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  }
  return anthropicClient;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the configured LLM provider and model from environment.
 */
export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || "openai") as LLMProvider;

  if (provider !== "openai" && provider !== "anthropic") {
    throw new Error(`Unknown LLM_PROVIDER: ${provider}. Use 'openai' or 'anthropic'.`);
  }

  const model = process.env.LLM_MODEL || DEFAULT_MODELS[provider];

  return { provider, model };
}

/**
 * Validate that required API keys are present.
 */
export function validateLLMConfig(config: LLMConfig): void {
  if (config.provider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is required when LLM_PROVIDER=openai. Set it via:\n  export OPENAI_API_KEY="sk-..."',
    );
  }

  if (config.provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic. Set it via:\n  export ANTHROPIC_API_KEY="sk-ant-..."',
    );
  }
}

/**
 * Send a prompt to the configured LLM and get a response.
 */
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 8192,
): Promise<LLMResponse> {
  const config = getLLMConfig();

  if (config.provider === "openai") {
    return openaiCompletion(config.model, systemPrompt, userPrompt, maxTokens);
  } else {
    return anthropicCompletion(config.model, systemPrompt, userPrompt, maxTokens);
  }
}

// ---------------------------------------------------------------------------
// OpenAI implementation
// ---------------------------------------------------------------------------

async function openaiCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<LLMResponse> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  return {
    content,
    model: response.model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

// ---------------------------------------------------------------------------
// Anthropic implementation
// ---------------------------------------------------------------------------

async function anthropicCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<LLMResponse> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Anthropic response");
  }

  return {
    content: textBlock.text,
    model: response.model,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
  };
}

/**
 * Get a human-readable description of the current LLM config.
 */
export function describeLLMConfig(): string {
  const config = getLLMConfig();
  return `${config.provider}/${config.model}`;
}
