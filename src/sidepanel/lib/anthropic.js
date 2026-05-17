function formatAttachment(kind, title, url, text) {
    const header = kind === "selection"
        ? `Selected text${title ? ` from ${title}` : ""}`
        : kind === "page"
            ? `Page context${title ? `: ${title}` : ""}`
            : "Tool result";
    return `${header}${url ? `\nURL: ${url}` : ""}\n\n${text}`;
}
function toAnthropicMessages(messages) {
    let system = "";
    const out = [];
    for (const m of messages) {
        if (m.role === "system") {
            system = system ? system + "\n\n" + m.content : m.content;
            continue;
        }
        if (m.role === "tool") {
            out.push({
                role: "user",
                content: (m.toolResults ?? []).map((r) => ({
                    type: "tool_result",
                    tool_use_id: r.toolUseId,
                    content: r.content,
                    is_error: r.isError,
                })),
            });
            continue;
        }
        const blocks = [];
        if (m.attachments?.length) {
            for (const a of m.attachments) {
                blocks.push({
                    type: "text",
                    text: formatAttachment(a.kind, a.title, a.url, a.text),
                });
            }
        }
        if (m.role === "assistant" && m.toolCalls?.length) {
            if (m.content)
                blocks.push({ type: "text", text: m.content });
            for (const tc of m.toolCalls) {
                blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
            }
        }
        else if (m.content) {
            blocks.push({ type: "text", text: m.content });
        }
        if (blocks.length === 0)
            continue;
        out.push({ role: m.role === "assistant" ? "assistant" : "user", content: blocks });
    }
    return { system, messages: out };
}
export async function streamAnthropic(opts) {
    const { apiKey, model, messages, tools, signal, cb } = opts;
    const { system, messages: anthMessages } = toAnthropicMessages(messages);
    const body = {
        model,
        max_tokens: 4096,
        stream: true,
        messages: anthMessages,
    };
    if (system) {
        body.system = [
            { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ];
    }
    if (tools?.length)
        body.tools = tools;
    let resp;
    try {
        resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            signal,
            headers: {
                "content-type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify(body),
        });
    }
    catch (e) {
        cb.onError(e);
        return;
    }
    if (!resp.ok || !resp.body) {
        cb.onError(new Error(`Anthropic ${resp.status}: ${await resp.text()}`));
        return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const toolCalls = new Map();
    const finalCalls = [];
    let stopReason = "end_turn";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            if (!line.startsWith("data:"))
                continue;
            const data = line.slice(5).trim();
            if (!data)
                continue;
            try {
                const ev = JSON.parse(data);
                if (ev.type === "content_block_start") {
                    if (ev.content_block?.type === "tool_use") {
                        toolCalls.set(ev.index, {
                            id: ev.content_block.id,
                            name: ev.content_block.name,
                            jsonAccum: "",
                        });
                    }
                }
                else if (ev.type === "content_block_delta") {
                    if (ev.delta?.type === "text_delta") {
                        cb.onText(ev.delta.text);
                    }
                    else if (ev.delta?.type === "input_json_delta") {
                        const cur = toolCalls.get(ev.index);
                        if (cur)
                            cur.jsonAccum += ev.delta.partial_json ?? "";
                    }
                }
                else if (ev.type === "content_block_stop") {
                    const cur = toolCalls.get(ev.index);
                    if (cur) {
                        let input = {};
                        try {
                            input = cur.jsonAccum ? JSON.parse(cur.jsonAccum) : {};
                        }
                        catch { }
                        const tc = { id: cur.id, name: cur.name, input };
                        finalCalls.push(tc);
                        cb.onToolUse(tc);
                    }
                }
                else if (ev.type === "message_delta") {
                    if (ev.delta?.stop_reason)
                        stopReason = ev.delta.stop_reason;
                }
            }
            catch { }
        }
    }
    cb.onDone({ stopReason, toolCalls: finalCalls });
}
export async function anthropicNonStream(opts) {
    const { system, messages } = toAnthropicMessages(opts.messages);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": opts.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
            model: opts.model,
            max_tokens: opts.maxTokens ?? 1024,
            system: system || undefined,
            messages,
        }),
    });
    if (!r.ok)
        throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return (j.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
}
