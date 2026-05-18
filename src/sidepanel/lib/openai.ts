import type { Message, ToolCall } from "../../shared/types";

export interface OpenAIToolDef {
  type: "function";
  function: { name: string; description: string; parameters: any };
}

export interface OpenAIStreamCallbacks {
  onText: (delta: string) => void;
  onToolUse: (call: ToolCall) => void;
  onDone: (result: { stopReason: string; toolCalls: ToolCall[] }) => void;
  onError: (e: Error) => void;
}

function formatAttachment(kind: string, title: string | undefined, url: string | undefined, text: string) {
  const header =
    kind === "selection"
      ? `Selected text${title ? ` from ${title}` : ""}`
      : kind === "page"
      ? `Page context${title ? `: ${title}` : ""}`
      : "Tool result";
  return `${header}${url ? `\nURL: ${url}` : ""}\n\n${text}`;
}

function toOpenAIMessages(messages: Message[]): any[] {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      out.push({ role: "system", content: m.content });
      continue;
    }
    if (m.role === "tool") {
      for (const r of m.toolResults ?? []) {
        out.push({
          role: "tool",
          tool_call_id: r.toolUseId,
          content: r.content,
        });
      }
      continue;
    }
    let content = m.content || "";
    if (m.attachments?.length) {
      const blocks = m.attachments
        .map((a) => formatAttachment(a.kind, a.title, a.url, a.text))
        .join("\n\n");
      content = blocks + (content ? "\n\n" + content : "");
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        })),
      });
    } else {
      out.push({ role: m.role, content });
    }
  }
  return out;
}

export async function streamOpenAI(opts: {
  apiKey: string;
  model: string;
  messages: Message[];
  reasoningEffort?: string;
  tools?: OpenAIToolDef[];
  signal?: AbortSignal;
  cb: OpenAIStreamCallbacks;
}) {
  const { apiKey, model, messages, reasoningEffort, tools, signal, cb } = opts;
  const body: any = {
    model,
    stream: true,
    messages: toOpenAIMessages(messages),
  };
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;
  if (tools?.length) body.tools = tools;

  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    cb.onError(e);
    return;
  }

  if (!resp.ok || !resp.body) {
    cb.onError(new Error(`OpenAI ${resp.status}: ${await resp.text()}`));
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const tools_accum = new Map<number, { id: string; name: string; args: string }>();
  let stopReason = "stop";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        const choice = ev.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta ?? {};
        if (delta.content) cb.onText(delta.content);
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = tools_accum.get(idx) ?? { id: "", name: "", args: "" };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            tools_accum.set(idx, cur);
          }
        }
        if (choice.finish_reason) stopReason = choice.finish_reason;
      } catch {}
    }
  }

  const finalCalls: ToolCall[] = [];
  for (const cur of tools_accum.values()) {
    let input: any = {};
    try { input = cur.args ? JSON.parse(cur.args) : {}; } catch {}
    const tc = { id: cur.id, name: cur.name, input };
    finalCalls.push(tc);
    cb.onToolUse(tc);
  }
  cb.onDone({ stopReason, toolCalls: finalCalls });
}

export async function openaiNonStream(opts: {
  apiKey: string;
  model: string;
  messages: Message[];
  reasoningEffort?: string;
}): Promise<string> {
  const body: any = {
    model: opts.model,
    messages: toOpenAIMessages(opts.messages),
  };
  if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}
