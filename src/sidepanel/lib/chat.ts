import { nanoid } from "nanoid";
import type { Attachment, Conversation, Message, ToolCall, ToolResult } from "../../shared/types";
import { db, listMessages } from "./db";
import { getModel } from "./models";
import { loadSettings } from "./keys";
import { buildSendArray } from "./compact";
import { streamAnthropic } from "./anthropic";
import { streamOpenAI } from "./openai";
import { streamGemini } from "./gemini";
import { TOOLS, anthropicTools, openaiTools, executeTool } from "./tools/registry";

const SYSTEM_PROMPT = `You are Otto, a browsing sidekick. You help users understand, research, and act on what they're reading.

Behavior:
- Be concise and conversational. Short answers by default; expand only when asked.
- If page text or selected text is attached, read it first before using tools. Quote titles or URLs when summarizing sources.
- Use Markdown formatting only when it adds clarity (code blocks for code, lists for enumerable items). Avoid heavy structure like headings or tables for simple questions.
- When using a tool, briefly say what you're doing (e.g. "Fetching that URL…").
- Do not produce long documents, implementation plans, or structured write-ups unless explicitly asked.`;

const MAX_TOOL_ITERATIONS = 8;

export interface SendOpts {
  conversationId: string;
  userText: string;
  attachments: Attachment[];
  onUpdate: () => void;
  signal?: AbortSignal;
}

export async function sendUserMessage(opts: SendOpts) {
  const conv = await db.conversations.get(opts.conversationId);
  if (!conv) throw new Error("no conversation");
  const settings = await loadSettings();
  const model = getModel(conv.modelId);
  const apiKey =
    model.provider === "anthropic"
      ? settings.anthropicKey
      : model.provider === "google"
      ? settings.geminiKey
      : settings.openaiKey;
  if (!apiKey) {
    const providerName =
      model.provider === "anthropic" ? "Anthropic" : model.provider === "google" ? "Gemini" : "OpenAI";
    throw new Error(`Missing ${providerName} API key. Add it in Settings.`);
  }

  const systemPrompt = settings.customInstructions
    ? `${SYSTEM_PROMPT}\n\nCustom instructions from user:\n${settings.customInstructions}`
    : SYSTEM_PROMPT;

  const now = Date.now();
  const userMsg: Message = {
    id: nanoid(),
    conversationId: conv.id,
    role: "user",
    content: opts.userText,
    attachments: opts.attachments.length ? opts.attachments : undefined,
    createdAt: now,
  };
  await db.messages.add(userMsg);

  // Title from first user message.
  if (conv.title === "New chat" || !conv.title) {
    const title = opts.userText.slice(0, 60).trim() || "New chat";
    await db.conversations.update(conv.id, { title, updatedAt: now });
  } else {
    await db.conversations.update(conv.id, { updatedAt: now });
  }
  opts.onUpdate();

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    if (opts.signal?.aborted) return;
    const all = await listMessages(conv.id);
    const fresh = await db.conversations.get(conv.id);
    if (!fresh) return;
    const sys: Message = {
      id: "system", conversationId: conv.id, role: "system",
      content: systemPrompt, createdAt: 0,
    };
    const built = await buildSendArray(fresh, [sys, ...all], settings);

    const assistant: Message = {
      id: nanoid(),
      conversationId: conv.id,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    await db.messages.add(assistant);
    opts.onUpdate();

    let textAccum = "";
    const toolCalls: ToolCall[] = [];
    let stopReason = "end_turn";

    const cb = {
      onText: (delta: string) => {
        textAccum += delta;
        db.messages.update(assistant.id, { content: textAccum });
        opts.onUpdate();
      },
      onToolUse: (tc: ToolCall) => {
        toolCalls.push(tc);
      },
      onDone: (r: { stopReason: string; toolCalls: ToolCall[] }) => {
        stopReason = r.stopReason;
      },
      onError: (e: Error) => {
        textAccum += `\n\n[error: ${e.message}]`;
        db.messages.update(assistant.id, { content: textAccum });
        opts.onUpdate();
      },
    };

    if (model.provider === "anthropic") {
      await streamAnthropic({
        apiKey, model: model.id, messages: built.toSend,
        tools: anthropicTools(TOOLS), signal: opts.signal, cb,
      });
    } else if (model.provider === "google") {
      await streamGemini({
        apiKey, model: model.id, messages: built.toSend,
        signal: opts.signal, cb,
      });
    } else {
      await streamOpenAI({
        apiKey, model: model.id, messages: built.toSend,
        reasoningEffort: fresh.reasoningEffort,
        tools: openaiTools(TOOLS), signal: opts.signal, cb,
      });
    }

    if (toolCalls.length > 0) {
      await db.messages.update(assistant.id, { toolCalls });
    }

    const isToolStop =
      stopReason === "tool_use" ||
      stopReason === "tool_calls" ||
      stopReason === "FUNCTION_CALL";
    if (!isToolStop || toolCalls.length === 0) {
      return;
    }

    // Execute tools and append a tool-role message with results.
    const results: ToolResult[] = [];
    for (const call of toolCalls) {
      try {
        const out = await executeTool(call.name, call.input);
        results.push({ toolUseId: call.id, content: out });
      } catch (e: any) {
        results.push({ toolUseId: call.id, content: String(e?.message ?? e), isError: true });
      }
    }
    const toolMsg: Message = {
      id: nanoid(),
      conversationId: conv.id,
      role: "tool",
      content: "",
      toolResults: results,
      createdAt: Date.now(),
    };
    await db.messages.add(toolMsg);
    opts.onUpdate();
    // loop again
  }
}
