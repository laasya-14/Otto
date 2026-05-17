import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message as MsgT } from "../../shared/types";

export function MessageRow({ m }: { m: MsgT }) {
  const [copied, setCopied] = useState(false);
  if (m.role === "system") return null;
  if (m.role === "tool") {
    return (
      <div className="msg tool">
        {(m.toolResults ?? []).map((r) => (
          <details key={r.toolUseId} className="toolcall">
            <summary>tool result {r.isError ? "(error)" : ""}</summary>
            <pre>{r.content}</pre>
          </details>
        ))}
      </div>
    );
  }
  const roleLabel = m.role === "user" ? "you" : "assistant";

  async function copyText() {
    if (!m.content) return;
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className={`msg ${m.role}`}>
      <div className="msg-header">
        <div className="role">{roleLabel}</div>
        {m.content ? (
          <button type="button" className="copy-btn" onClick={copyText}>
            {copied ? "copied" : "copy"}
          </button>
        ) : null}
      </div>
      {m.attachments && m.attachments.length > 0 && (
        <div className="attachments-block">
          <div className="attachments-label">context</div>
          <div className="attachments">
            {m.attachments.map((a, i) => (
              <span key={i} className={`chip ${a.kind === "page" ? "chip-page" : a.kind === "selection" ? "chip-selection" : ""}`} title={a.text.slice(0, 280)}>
                {a.kind === "page" ? "Page context" : a.kind === "selection" ? "Selected text" : "Tool"}: {a.kind === "selection"
                  ? a.text.replace(/\s+/g, " ").slice(0, 56)
                  : a.title ?? a.url ?? ""}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="bubble">
        {m.role === "assistant" ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "…"}</ReactMarkdown>
        ) : (
          m.content
        )}
      </div>
      {m.role === "assistant" && m.content ? (
        <div className="message-actions">
          <button type="button" className="copy-btn copy-btn-inline" onClick={copyText}>
            {copied ? "Copied" : "Copy text"}
          </button>
        </div>
      ) : null}
      {m.toolCalls?.map((tc) => (
        <details key={tc.id} className="toolcall">
          <summary>called {tc.name}</summary>
          <pre>{JSON.stringify(tc.input, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}
