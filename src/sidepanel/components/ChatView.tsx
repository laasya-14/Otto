import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Attachment, PendingContext } from "../../shared/types";
import { db } from "../lib/db";
import { MODELS } from "../lib/models";
import { fetchPendingContext, onPendingContext } from "../lib/messaging";
import { sendUserMessage } from "../lib/chat";
import { Composer } from "./Composer";
import { MessageRow } from "./Message";

interface Props {
  conversationId: string;
  onOpenSettings: () => void;
  onOpenSkills: (draft?: any) => void;
}

export function ChatView({ conversationId, onOpenSettings, onOpenSkills }: Props) {
  const conv = useLiveQuery(() => db.conversations.get(conversationId), [conversationId]);
  const messages = useLiveQuery(
    () =>
      db.messages
        .where("[conversationId+createdAt]")
        .between([conversationId, 0], [conversationId, Infinity])
        .toArray(),
    [conversationId]
  );

  const [pending, setPending] = useState<Attachment[]>([]);
  const [freshChipIdx, setFreshChipIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledPendingStamp = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function showToast(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2700);
  }

  // Pull pending context: poll briefly on mount (avoids races with background
  // writes), plus listen for live broadcasts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
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

  function addPendingContext(ctx: PendingContext) {
    const stamp = `${ctx.at}:${ctx.items
      .map((item) => `${item.kind}:${item.payload.url}:${item.payload.title ?? ""}`)
      .join("|")}`;
    if (handledPendingStamp.current === stamp) return;
    handledPendingStamp.current = stamp;

    const nextAttachments = ctx.items
      .map((item) => toAttachment(item.kind, item.payload))
      .filter((item): item is Attachment => Boolean(item));

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
    } else if (selectionCount) {
      showToast("Added selected text");
    } else {
      showToast("Added page context");
    }
    setTimeout(() => setFreshChipIdx(null), 1000);
  }

  function toAttachment(kind: "selection" | "page", payload: any): Attachment | null {
    const a: Attachment =
      kind === "selection"
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

  function mergeAttachments(current: Attachment[], incoming: Attachment[]) {
    const map = new Map<string, Attachment>();
    for (const item of current) map.set(attachmentKey(item), item);
    for (const item of incoming) map.set(attachmentKey(item), item);
    return Array.from(map.values());
  }

  function attachmentKey(item: Attachment) {
    return `${item.kind}:${item.url ?? ""}:${item.text}`;
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages?.length, messages?.[messages.length - 1]?.content]);

  async function changeModel(id: string) {
    await db.conversations.update(conversationId, { modelId: id, updatedAt: Date.now() });
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleSend(text: string, attachments: Attachment[]) {
    setError(null);
    setSending(true);
    setStreaming(false);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await sendUserMessage({
        conversationId,
        userText: text,
        attachments,
        onUpdate: () => setStreaming(true),
        signal: controller.signal,
      });
    } catch (e: any) {
      if ((e as any)?.name !== "AbortError") {
        setError(e?.message ?? String(e));
      }
    } finally {
      setSending(false);
      setStreaming(false);
      abortRef.current = null;
    }
  }

  if (!conv) return <div className="empty">Loading…</div>;

  const isCompacted = Boolean(conv.summary);
  const modelsByProvider = MODELS.reduce<Record<string, typeof MODELS>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});
  const providerLabels: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google" };

  return (
    <>
      {toast && <div className={`toast ${toast.kind === "err" ? "err" : ""}`}>{toast.msg}</div>}
      <div className="topbar chat-header">
        <span className="chat-title">
          {conv.title}
        </span>
        <div className="topbar-right">
          <select value={conv.modelId} onChange={(e) => changeModel(e.target.value)}>
            {Object.entries(modelsByProvider).map(([provider, models]) => (
              <optgroup key={provider} label={providerLabels[provider] ?? provider}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {sending && (
            <button className="stop-btn" onClick={handleStop} title="Stop generating">■ Stop</button>
          )}
        </div>
      </div>
      <div className="messages" ref={scrollRef}>
        {(!messages || messages.length === 0) && (
          <div className="empty">
            Ask about the current page, or capture a highlight with <strong>⌘⇧L</strong>.
          </div>
        )}
        {isCompacted && (
          <div className="compacted-badge" title="Earlier messages were summarized to fit the context window">
            ↑ earlier context summarized
          </div>
        )}
        {messages?.map((m) => <MessageRow key={m.id} m={m} />)}
        {streaming && !error && (
          <div className="streaming-indicator">
            <span className="streaming-dot" /><span className="streaming-dot" /><span className="streaming-dot" />
          </div>
        )}
        {error && (
          <div className="msg assistant">
            <div className="role">error</div>
            <div className="bubble" style={{ color: "#ff7575" }}>
              {error} {error.includes("API key") && (
                <button onClick={onOpenSettings} style={{ marginLeft: 6 }}>Open settings</button>
              )}
            </div>
          </div>
        )}
      </div>
      <Composer
        pendingAttachments={pending}
        freshIdx={freshChipIdx}
        setPendingAttachments={setPending}
        onSend={handleSend}
        onOpenSkills={onOpenSkills}
        disabled={sending}
      />
    </>
  );
}
