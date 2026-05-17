import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { MODELS } from "../lib/models";
import { fetchPendingContext, onPendingContext } from "../lib/messaging";
import { sendUserMessage } from "../lib/chat";
import { Composer } from "./Composer";
import { MessageRow } from "./Message";
export function ChatView({ conversationId, onOpenSettings, onOpenSkills }) {
    const conv = useLiveQuery(() => db.conversations.get(conversationId), [conversationId]);
    const messages = useLiveQuery(() => db.messages
        .where("[conversationId+createdAt]")
        .between([conversationId, 0], [conversationId, Infinity])
        .toArray(), [conversationId]);
    const [pending, setPending] = useState([]);
    const [freshChipIdx, setFreshChipIdx] = useState(null);
    const [toast, setToast] = useState(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const scrollRef = useRef(null);
    const handledPendingStamp = useRef(null);
    function showToast(msg, kind = "ok") {
        setToast({ msg, kind });
        setTimeout(() => setToast(null), 2700);
    }
    // Pull pending context: poll briefly on mount (avoids races with background
    // writes), plus listen for live broadcasts.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            for (let i = 0; i < 10; i++) {
                if (cancelled)
                    return;
                const ctx = await fetchPendingContext();
                if (ctx) {
                    addPendingContext(ctx);
                    return;
                }
                await new Promise((r) => setTimeout(r, 200));
            }
        })();
        const off = onPendingContext(() => {
            fetchPendingContext().then((c) => c && addPendingContext(c));
        });
        return () => {
            cancelled = true;
            off();
        };
    }, [conversationId]);
    function addPendingContext(ctx) {
        const stamp = `${ctx.at}:${ctx.items
            .map((item) => `${item.kind}:${item.payload.url}:${item.payload.title ?? ""}`)
            .join("|")}`;
        if (handledPendingStamp.current === stamp)
            return;
        handledPendingStamp.current = stamp;
        const nextAttachments = ctx.items
            .map((item) => toAttachment(item.kind, item.payload))
            .filter((item) => Boolean(item));
        if (nextAttachments.length === 0) {
            showToast("Couldn't capture page context from this tab", "err");
            return;
        }
        setPending((current) => {
            const merged = mergeAttachments(current, nextAttachments);
            const freshStart = Math.max(0, merged.length - nextAttachments.length);
            setFreshChipIdx(freshStart);
            return merged;
        });
        const selectionCount = nextAttachments.filter((item) => item.kind === "selection").length;
        const pageCount = nextAttachments.filter((item) => item.kind === "page").length;
        if (selectionCount && pageCount) {
            showToast("Added selected text and full page context");
        }
        else if (selectionCount) {
            showToast("Added selected text");
        }
        else {
            showToast("Added page context");
        }
        setTimeout(() => setFreshChipIdx(null), 1000);
    }
    function toAttachment(kind, payload) {
        const a = kind === "selection"
            ? {
                kind: "selection",
                url: payload.url,
                title: payload.title,
                text: payload.selection ?? "",
            }
            : {
                kind: "page",
                url: payload.url,
                title: payload.title,
                text: payload.pageText ?? "",
            };
        if (!a.text || !a.text.trim()) {
            return null;
        }
        return a;
    }
    function mergeAttachments(current, incoming) {
        const map = new Map();
        for (const item of current)
            map.set(attachmentKey(item), item);
        for (const item of incoming)
            map.set(attachmentKey(item), item);
        return Array.from(map.values());
    }
    function attachmentKey(item) {
        return `${item.kind}:${item.url ?? ""}:${item.text}`;
    }
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, [messages?.length, messages?.[messages.length - 1]?.content]);
    async function changeModel(id) {
        await db.conversations.update(conversationId, { modelId: id, updatedAt: Date.now() });
    }
    async function handleSend(text, attachments) {
        setError(null);
        setSending(true);
        try {
            await sendUserMessage({
                conversationId,
                userText: text,
                attachments,
                onUpdate: () => { },
            });
        }
        catch (e) {
            setError(e?.message ?? String(e));
        }
        finally {
            setSending(false);
        }
    }
    if (!conv)
        return _jsx("div", { className: "empty", children: "Loading\u2026" });
    return (_jsxs(_Fragment, { children: [toast && _jsx("div", { className: `toast ${toast.kind === "err" ? "err" : ""}`, children: toast.msg }), _jsxs("div", { className: "topbar chat-header", children: [_jsx("span", { className: "chat-title", children: conv.title }), _jsx("select", { value: conv.modelId, onChange: (e) => changeModel(e.target.value), children: MODELS.map((m) => (_jsx("option", { value: m.id, children: m.label }, m.id))) })] }), _jsxs("div", { className: "messages", ref: scrollRef, children: [(!messages || messages.length === 0) && (_jsxs("div", { className: "empty", children: ["Ask about the current page, or capture a highlight with ", _jsx("strong", { children: "\u2318\u21E7L" }), "."] })), messages?.map((m) => _jsx(MessageRow, { m: m }, m.id)), error && (_jsxs("div", { className: "msg assistant", children: [_jsx("div", { className: "role", children: "error" }), _jsxs("div", { className: "bubble", style: { color: "#ff7575" }, children: [error, " ", error.includes("API key") && (_jsx("button", { onClick: onOpenSettings, style: { marginLeft: 6 }, children: "Open settings" }))] })] }))] }), _jsx(Composer, { pendingAttachments: pending, freshIdx: freshChipIdx, setPendingAttachments: setPending, onSend: handleSend, onOpenSkills: onOpenSkills, disabled: sending })] }));
}
