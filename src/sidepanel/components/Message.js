import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function MessageRow({ m }) {
    const [copied, setCopied] = useState(false);
    if (m.role === "system")
        return null;
    if (m.role === "tool") {
        return (_jsx("div", { className: "msg tool", children: (m.toolResults ?? []).map((r) => (_jsxs("details", { className: "toolcall", children: [_jsxs("summary", { children: ["tool result ", r.isError ? "(error)" : ""] }), _jsx("pre", { children: r.content })] }, r.toolUseId))) }));
    }
    const roleLabel = m.role === "user" ? "you" : "assistant";
    async function copyText() {
        if (!m.content)
            return;
        try {
            await navigator.clipboard.writeText(m.content);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        }
        catch { }
    }
    return (_jsxs("div", { className: `msg ${m.role}`, children: [_jsxs("div", { className: "msg-header", children: [_jsx("div", { className: "role", children: roleLabel }), m.content ? (_jsx("button", { type: "button", className: "copy-btn", onClick: copyText, children: copied ? "copied" : "copy" })) : null] }), m.attachments && m.attachments.length > 0 && (_jsxs("div", { className: "attachments-block", children: [_jsx("div", { className: "attachments-label", children: "context" }), _jsx("div", { className: "attachments", children: m.attachments.map((a, i) => (_jsxs("span", { className: `chip ${a.kind === "page" ? "chip-page" : a.kind === "selection" ? "chip-selection" : ""}`, title: a.text.slice(0, 280), children: [a.kind === "page" ? "Page context" : a.kind === "selection" ? "Selected text" : "Tool", ": ", a.kind === "selection"
                                    ? a.text.replace(/\s+/g, " ").slice(0, 56)
                                    : a.title ?? a.url ?? ""] }, i))) })] })), _jsx("div", { className: "bubble", children: m.role === "assistant" ? (_jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], children: m.content || "…" })) : (m.content) }), m.role === "assistant" && m.content ? (_jsx("div", { className: "message-actions", children: _jsx("button", { type: "button", className: "copy-btn copy-btn-inline", onClick: copyText, children: copied ? "Copied" : "Copy text" }) })) : null, m.toolCalls?.map((tc) => (_jsxs("details", { className: "toolcall", children: [_jsxs("summary", { children: ["called ", tc.name] }), _jsx("pre", { children: JSON.stringify(tc.input, null, 2) })] }, tc.id)))] }));
}
