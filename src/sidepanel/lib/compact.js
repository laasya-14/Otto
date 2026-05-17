import { db } from "./db";
import { getModel, CHEAP_SUMMARIZER } from "./models";
import { anthropicNonStream } from "./anthropic";
import { openaiNonStream } from "./openai";
const COMPACT_TRIGGER = 0.7;
const COMPACT_TARGET = 0.45;
export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
export function estimateMessageTokens(m) {
    let n = estimateTokens(m.content || "");
    for (const a of m.attachments ?? [])
        n += estimateTokens(a.text);
    for (const r of m.toolResults ?? [])
        n += estimateTokens(r.content);
    for (const c of m.toolCalls ?? [])
        n += estimateTokens(JSON.stringify(c.input || {}));
    return n + 4;
}
// Dedup repeated page/selection attachments — only the latest copy keeps full text.
export function dedupAttachments(messages) {
    const seen = new Map();
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (!m.attachments)
            continue;
        for (const a of m.attachments) {
            if (a.kind !== "page" && a.kind !== "selection")
                continue;
            const key = `${a.kind}:${a.url ?? ""}`;
            if (!seen.has(key))
                seen.set(key, i);
        }
    }
    return messages.map((m, i) => {
        if (!m.attachments)
            return m;
        const next = m.attachments.map((a) => {
            if (a.kind !== "page" && a.kind !== "selection")
                return a;
            const key = `${a.kind}:${a.url ?? ""}`;
            if (seen.get(key) === i)
                return a;
            return { ...a, text: `[${a.kind} re-attached later: ${a.title ?? a.url ?? ""}]` };
        });
        return { ...m, attachments: next };
    });
}
export async function buildSendArray(conv, allMessages, settings) {
    const model = getModel(conv.modelId);
    const limit = Math.floor(model.contextWindow * COMPACT_TRIGGER);
    // Start with everything after summaryThroughMessageId
    let cutoff = -1;
    if (conv.summaryThroughMessageId) {
        cutoff = allMessages.findIndex((m) => m.id === conv.summaryThroughMessageId);
    }
    let recent = cutoff >= 0 ? allMessages.slice(cutoff + 1) : allMessages.slice();
    let summary = conv.summary ?? "";
    let assembled = assemble(summary, recent);
    let total = sum(assembled);
    if (total > limit) {
        // Summarize oldest ~60% of recent into the summary.
        const splitAt = Math.max(1, Math.floor(recent.length * 0.6));
        const toSummarize = recent.slice(0, splitAt);
        const remaining = recent.slice(splitAt);
        const newSummary = await summarize(summary, toSummarize, settings);
        summary = newSummary;
        const lastSummarized = toSummarize[toSummarize.length - 1];
        await db.conversations.update(conv.id, {
            summary,
            summaryThroughMessageId: lastSummarized?.id,
            updatedAt: Date.now(),
        });
        recent = remaining;
        assembled = assemble(summary, recent);
        total = sum(assembled);
        // Hard cap: if still over, truncate oldest page attachment.
        if (total > limit) {
            for (const m of assembled) {
                if (!m.attachments)
                    continue;
                for (const a of m.attachments) {
                    if (a.kind === "page" && a.text.length > 2000) {
                        a.text = a.text.slice(0, 2000) + `\n[truncated]`;
                    }
                }
            }
            total = sum(assembled);
        }
        return { toSend: assembled, compacted: true, estimatedTokens: total };
    }
    return { toSend: assembled, compacted: false, estimatedTokens: total };
}
function assemble(summary, recent) {
    const out = [];
    if (summary) {
        out.push({
            id: "summary",
            conversationId: "",
            role: "system",
            content: `Summary of earlier conversation:\n\n${summary}`,
            createdAt: 0,
        });
    }
    for (const m of dedupAttachments(recent))
        out.push(m);
    return out;
}
function sum(msgs) {
    return msgs.reduce((acc, m) => acc + estimateMessageTokens(m), 0);
}
async function summarize(prior, toSummarize, settings) {
    const transcript = toSummarize
        .map((m) => {
        const atts = (m.attachments ?? [])
            .map((a) => `[${a.kind}${a.url ? `:${a.url}` : ""}]\n${a.text}`)
            .join("\n");
        return `## ${m.role}\n${atts ? atts + "\n\n" : ""}${m.content}`.trim();
    })
        .join("\n\n");
    const prompt = `You are summarizing a conversation between a user and an AI assistant about webpages. Preserve all facts, decisions, code, URLs, identifiers, and any user preferences expressed. Output ≤500 tokens of plain prose. Do not editorialize.

${prior ? `Existing summary:\n${prior}\n\n` : ""}New turns to incorporate:\n${transcript}`;
    const fakeMsg = {
        id: "x", conversationId: "", role: "user", content: prompt, createdAt: 0,
    };
    if (settings.anthropicKey) {
        return anthropicNonStream({
            apiKey: settings.anthropicKey,
            model: CHEAP_SUMMARIZER.anthropic,
            messages: [fakeMsg],
            maxTokens: 700,
        });
    }
    if (settings.openaiKey) {
        return openaiNonStream({
            apiKey: settings.openaiKey,
            model: CHEAP_SUMMARIZER.openai,
            messages: [fakeMsg],
        });
    }
    // No keys — return prior + truncated transcript.
    return (prior ? prior + "\n\n" : "") + transcript.slice(0, 4000);
}
