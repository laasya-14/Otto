import type { Message, ToolCall } from "../../shared/types";

export interface GeminiStreamCallbacks {
  onText: (delta: string) => void;
  onToolUse: (call: ToolCall) => void;
  onDone: (result: { stopReason: string; toolCalls: ToolCall[] }) => void;
  onError: (e: Error) => void;
}

function toGeminiContents(messages: Message[]): { systemInstruction?: string; contents: any[] } {
  let systemInstruction: string | undefined;
  const contents: any[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemInstruction = systemInstruction
        ? systemInstruction + "\n\n" + m.content
        : m.content;
      continue;
    }
    if (m.role === "tool") {
      contents.push({
        role: "user",
        parts: (m.toolResults ?? []).map((r) => ({
          functionResponse: {
            name: r.toolUseId,
            response: { output: r.content, isError: r.isError ?? false },
          },
        })),
      });
      continue;
    }

    const parts: any[] = [];

    if (m.attachments?.length) {
      for (const a of m.attachments) {
        if (a.kind === "video_url" && a.url) {
          parts.push({
            fileData: {
              mimeType: "video/mp4",
              fileUri: a.url,
            },
          });
          if (a.title) parts.push({ text: `Video: ${a.title}` });
        } else {
          const header =
            a.kind === "selection"
              ? `Selected text${a.title ? ` from ${a.title}` : ""}${a.url ? `\nURL: ${a.url}` : ""}`
              : a.kind === "page"
              ? `Page context${a.title ? `: ${a.title}` : ""}${a.url ? `\nURL: ${a.url}` : ""}`
              : "Tool result";
          parts.push({ text: `${header}\n\n${a.text}` });
        }
      }
    }

    if (m.role === "assistant" && m.toolCalls?.length) {
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls) {
        parts.push({ functionCall: { name: tc.name, args: tc.input } });
      }
    } else if (m.content) {
      parts.push({ text: m.content });
    }

    if (parts.length === 0) continue;
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts });
  }

  return { systemInstruction, contents };
}

export async function streamGemini(opts: {
  apiKey: string;
  model: string;
  messages: Message[];
  signal?: AbortSignal;
  cb: GeminiStreamCallbacks;
}) {
  const { apiKey, model, messages, signal, cb } = opts;
  const { systemInstruction, contents } = toGeminiContents(messages);

  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    cb.onError(e);
    return;
  }

  if (!resp.ok || !resp.body) {
    cb.onError(new Error(`Gemini ${resp.status}: ${await resp.text()}`));
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let stopReason = "STOP";
  const finalCalls: ToolCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      try {
        const ev = JSON.parse(data);
        const candidate = ev.candidates?.[0];
        if (!candidate) continue;
        if (candidate.finishReason) stopReason = candidate.finishReason;
        for (const part of candidate.content?.parts ?? []) {
          if (part.text) {
            cb.onText(part.text);
          } else if (part.functionCall) {
            const tc: ToolCall = {
              id: `fc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: part.functionCall.name,
              input: part.functionCall.args ?? {},
            };
            finalCalls.push(tc);
            cb.onToolUse(tc);
          }
        }
      } catch {}
    }
  }

  cb.onDone({ stopReason, toolCalls: finalCalls });
}

export async function geminiNonStream(opts: {
  apiKey: string;
  model: string;
  messages: Message[];
  maxTokens?: number;
}): Promise<string> {
  const { systemInstruction, contents } = toGeminiContents(opts.messages);
  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (opts.maxTokens) {
    body.generationConfig = { maxOutputTokens: opts.maxTokens };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts ?? [])
    .filter((p: any) => p.text)
    .map((p: any) => p.text)
    .join("");
}
