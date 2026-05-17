import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteAllConversations, deleteConversation } from "../lib/db";
export function HistoryView({ onOpen, currentId }) {
    const conversations = useLiveQuery(() => db.conversations.orderBy("updatedAt").reverse().toArray(), []);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(new Set());
    const filtered = useMemo(() => {
        if (!conversations)
            return [];
        const q = query.trim().toLowerCase();
        if (!q)
            return conversations;
        return conversations.filter((c) => c.title.toLowerCase().includes(q));
    }, [conversations, query]);
    function toggle(id) {
        const next = new Set(selected);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        setSelected(next);
    }
    async function deleteSelected() {
        if (selected.size === 0)
            return;
        if (!confirm(`Delete ${selected.size} conversation(s)?`))
            return;
        for (const id of selected)
            await deleteConversation(id);
        setSelected(new Set());
    }
    async function deleteAll() {
        if (!confirm("Delete ALL conversations? This cannot be undone."))
            return;
        if (!confirm("Really delete all chat history?"))
            return;
        await deleteAllConversations();
        setSelected(new Set());
    }
    async function deleteOne(id, e) {
        e.stopPropagation();
        if (!confirm("Delete this conversation?"))
            return;
        await deleteConversation(id);
    }
    return (_jsxs("div", { className: "history", children: [_jsx("input", { className: "search", placeholder: "Search\u2026", value: query, onChange: (e) => setQuery(e.target.value) }), selected.size > 0 && (_jsxs("div", { className: "bulkbar", children: [_jsxs("span", { style: { flex: 1 }, children: [selected.size, " selected"] }), _jsx("button", { onClick: () => setSelected(new Set()), children: "Clear" }), _jsx("button", { className: "danger", onClick: deleteSelected, children: "Delete selected" })] })), filtered.length === 0 && _jsx("div", { className: "empty", children: "No conversations." }), filtered.map((c) => (_jsxs("div", { className: "row" + (c.id === currentId ? " selected" : ""), onClick: () => onOpen(c.id), children: [_jsx("input", { type: "checkbox", checked: selected.has(c.id), onChange: (e) => { e.stopPropagation(); toggle(c.id); }, onClick: (e) => e.stopPropagation() }), _jsxs("div", { className: "meta", children: [_jsx("div", { className: "title", children: c.title || "Untitled" }), _jsxs("div", { className: "sub", children: [new Date(c.updatedAt).toLocaleString(), " \u00B7 ", c.modelId] })] }), _jsx("button", { className: "del", onClick: (e) => deleteOne(c.id, e), title: "Delete", children: "\u2715" })] }, c.id))), filtered.length > 0 && (_jsx("div", { style: { marginTop: 16, textAlign: "center" }, children: _jsx("button", { className: "danger", onClick: deleteAll, children: "Delete all history" }) }))] }));
}
