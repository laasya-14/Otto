import type { ModelInfo } from "../../shared/types";

export const MODELS: ModelInfo[] = [
  // Anthropic — Claude 4.x
  { id: "claude-opus-4-7",        label: "Claude Opus 4.7",        provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  { id: "claude-sonnet-4-6",      label: "Claude Sonnet 4.6",      provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  { id: "claude-haiku-4-5",       label: "Claude Haiku 4.5",       provider: "anthropic", contextWindow: 200_000, supportsVision: true },
  // OpenAI — latest GPT-5 family
  { id: "gpt-5.5",           label: "GPT-5.5",           provider: "openai", contextWindow: 1_050_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.4",           label: "GPT-5.4",           provider: "openai", contextWindow: 1_050_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.4-mini",      label: "GPT-5.4 mini",      provider: "openai", contextWindow: 400_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.4-nano",      label: "GPT-5.4 nano",      provider: "openai", contextWindow: 400_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high", "xhigh"] },
  { id: "gpt-5.2",           label: "GPT-5.2",           provider: "openai", contextWindow: 400_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high"] },
  { id: "gpt-5.1",           label: "GPT-5.1",           provider: "openai", contextWindow: 400_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high"] },
  { id: "gpt-5",             label: "GPT-5",             provider: "openai", contextWindow: 400_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high"] },
  { id: "gpt-5-mini",        label: "GPT-5 mini",        provider: "openai", contextWindow: 400_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high"] },
  { id: "gpt-5-nano",        label: "GPT-5 nano",        provider: "openai", contextWindow: 400_000, supportsVision: true, reasoningEfforts: ["low", "medium", "high"] },
  // OpenAI — current general-purpose models
  { id: "gpt-4.1",           label: "GPT-4.1",           provider: "openai", contextWindow: 1_000_000, supportsVision: true },
  { id: "gpt-4.1-mini",      label: "GPT-4.1 mini",      provider: "openai", contextWindow: 1_000_000, supportsVision: true },
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
  openai: "gpt-5.4-nano",
  google: "gemini-2.5-flash",
};

export function getReasoningEfforts(modelId: string) {
  return MODELS.find((m) => m.id === modelId)?.reasoningEfforts ?? [];
}
