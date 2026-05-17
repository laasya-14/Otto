export const MODELS = [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", provider: "anthropic", contextWindow: 200_000, supportsVision: true },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", contextWindow: 200_000, supportsVision: true },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", contextWindow: 200_000, supportsVision: true },
    { id: "gpt-5", label: "GPT-5", provider: "openai", contextWindow: 200_000, supportsVision: true },
    { id: "gpt-4o", label: "GPT-4o", provider: "openai", contextWindow: 128_000, supportsVision: true },
    { id: "o3", label: "o3", provider: "openai", contextWindow: 200_000 },
];
export function getModel(id) {
    return MODELS.find((m) => m.id === id) ?? MODELS[1];
}
export const CHEAP_SUMMARIZER = {
    anthropic: "claude-haiku-4-5",
    openai: "gpt-4o-mini",
};
