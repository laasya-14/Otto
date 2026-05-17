import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteAllConversations, deleteConversation } from "../lib/db";

interface Props {
  onOpen: (id: string) => void;
  currentId?: string;
}

export function HistoryView({ onOpen, currentId }: Props) {
  const conversations = useLiveQuery(
    () => db.conversations.orderBy("updatedAt").reverse().toArray(),
    []
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!conversations) return [];
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} conversation(s)?`)) return;
    for (const id of selected) await deleteConversation(id);
    setSelected(new Set());
  }

  async function deleteAll() {
    if (!confirm("Delete ALL conversations? This cannot be undone.")) return;
    if (!confirm("Really delete all chat history?")) return;
    await deleteAllConversations();
    setSelected(new Set());
  }

  async function deleteOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    await deleteConversation(id);
  }

  return (
    <div className="history">
      <input
        className="search"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {selected.size > 0 && (
        <div className="bulkbar">
          <span style={{ flex: 1 }}>{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())}>Clear</button>
          <button className="danger" onClick={deleteSelected}>Delete selected</button>
        </div>
      )}
      {filtered.length === 0 && <div className="empty">No conversations.</div>}
      {filtered.map((c) => (
        <div
          key={c.id}
          className={"row" + (c.id === currentId ? " selected" : "")}
          onClick={() => onOpen(c.id)}
        >
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={(e) => { e.stopPropagation(); toggle(c.id); }}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="meta">
            <div className="title">{c.title || "Untitled"}</div>
            <div className="sub">
              {new Date(c.updatedAt).toLocaleString()} · {c.modelId}
            </div>
          </div>
          <button className="del" onClick={(e) => deleteOne(c.id, e)} title="Delete">✕</button>
        </div>
      ))}
      {filtered.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="danger" onClick={deleteAll}>Delete all history</button>
        </div>
      )}
    </div>
  );
}
