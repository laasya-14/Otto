import type { ModelInfo } from "../../shared/types";

export const MODELS: ModelInfo[] = [
  // Anthropic — Claude 4.x
  { id: "claude-opus-4-7",        label: "Claude Opus 4.7",        provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  { id: "claude-sonnet-4-6",      label: "Claude Sonnet 4.6",      provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  { id: "claude-haiku-4-5",       label: "Claude Haiku 4.5",       provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  // Anthropic — Claude 3.x
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet",  provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  { id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku",   provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  { id: "claude-3-opus-20240229",     label: "Claude 3 Opus",      provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  { id: "claude-3-haiku-20240307",    label: "Claude 3 Haiku",     provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  // OpenAI — GPT-5 / GPT-4o
  { id: "gpt-5",             label: "GPT-5",              provider: "openai", contextWindow: 200_000, supportsVision: true },
  { id: "gpt-4o",            label: "GPT-4o",             provider: "openai", contextWindow: 128_000, supportsVision: true },
  { id: "gpt-4o-mini",       label: "GPT-4o mini",        provider: "openai", contextWindow: 128_000, supportsVision: true },
  // OpenAI — o-series reasoning
  { id: "o3",                label: "o3",                 provider: "openai", contextWindow: 200_000 },
  { id: "o4-mini",           label: "o4-mini",            provider: "openai", contextWindow: 200_000 },
  // Google Gemini
  { id: "gemini-2.5-pro",    label: "Gemini 2.5 Pro",     provider: "google", contextWindow: 1_048_576, supportsVision: true },
  { id: "gemini-2.5-flash",  label: "Gemini 2.5 Flash",   provider: "google", contextWindow: 1_048_576, supportsVision: true },
  { id: "gemini-2.0-flash",  label: "Gemini 2.0 Flash",   provider: "google", contextWindow: 1_048_576, supportsVision: true },
];

export function getModel(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[1];
}

export const CHEAP_SUMMARIZER: Record<"anthropic" | "openai" | "google", string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  google: "gemini-2.5-flash",
};
