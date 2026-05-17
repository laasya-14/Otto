import type { Message, Skill } from "../../shared/types";
import { anthropicNonStream } from "./anthropic";
import { loadSettings } from "./keys";
import { getModel } from "./models";
import { openaiNonStream } from "./openai";

function escapeJson(text: string) {
  return text.replace(/```json|```/g, "").trim();
}

async function callSkillHelper(messages: Message[]) {
  const settings = await loadSettings();
  const model = getModel(settings.defaultModelId ?? "claude-sonnet-4-6");
  const apiKey = model.provider === "anthropic" ? settings.anthropicKey : settings.openaiKey;
  if (!apiKey) {
    throw new Error(`Missing ${model.provider === "anthropic" ? "Anthropic" : "OpenAI"} API key. Add it in Settings.`);
  }
  if (model.provider === "anthropic") {
    return anthropicNonStream({ apiKey, model: model.id, messages, maxTokens: 900 });
  }
  return openaiNonStream({ apiKey, model: model.id, messages });
}

export async function generateSkillDraft(input: { name?: string; description: string }) {
  const raw = await callSkillHelper([
    {
      id: "skill-gen",
      conversationId: "",
      role: "user",
      content:
        `Create a reusable browser-assistant skill.\n` +
        `Return strict JSON with keys: name, trigger, prompt.\n` +
        `Rules:\n` +
        `- trigger must be short, lowercase, kebab-case, no slash\n` +
        `- prompt must be the exact instruction that should be sent when the skill is invoked\n` +
        `- prompt should be self-contained and not mention that it is a skill\n` +
        `- name should be concise\n` +
        `Requested name: ${input.name?.trim() || "(infer one)"}\n` +
        `Description:\n${input.description.trim()}`,
      createdAt: 0,
    },
  ]);
  const parsed = JSON.parse(escapeJson(raw)) as { name: string; trigger: string; prompt: string };
  return parsed;
}

export async function refineSkillPrompt(input: { skill: Skill; changeRequest: string }) {
  const raw = await callSkillHelper([
    {
      id: "skill-refine",
      conversationId: "",
      role: "user",
      content:
        `Rewrite the prompt for this saved skill.\n` +
        `Return strict JSON with keys: prompt, trigger, name.\n` +
        `Keep the skill usable as a slash command.\n` +
        `Current skill:\n` +
        `name: ${input.skill.name}\n` +
        `trigger: ${input.skill.trigger}\n` +
        `description: ${input.skill.description}\n` +
        `prompt:\n${input.skill.prompt}\n\n` +
        `Requested change:\n${input.changeRequest.trim()}`,
      createdAt: 0,
    },
  ]);
  return JSON.parse(escapeJson(raw)) as { prompt: string; trigger: string; name: string };
}
