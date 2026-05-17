import { useEffect, useState } from "react";
import { ChatView } from "./components/ChatView";
import { HistoryView } from "./components/HistoryView";
import { SkillsView } from "./components/SkillsView";
import { SettingsView } from "./components/SettingsView";
import { createConversation, db } from "./lib/db";
import { loadSettings } from "./lib/keys";
import { MODELS } from "./lib/models";

type View = "chat" | "history" | "skills" | "settings";

export function App() {
  const [view, setView] = useState<View>("chat");
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [bootDone, setBootDone] = useState(false);
  const [skillDraft, setSkillDraft] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const settings = await loadSettings();
      const last = await db.conversations.orderBy("updatedAt").last();
      if (last) {
        setCurrentConvId(last.id);
      } else {
        const def = settings.defaultModelId ?? MODELS[1].id;
        const c = await createConversation(def);
        setCurrentConvId(c.id);
      }
      setBootDone(true);
    })();
  }, []);

  async function newChat() {
    const settings = await loadSettings();
    const def = settings.defaultModelId ?? MODELS[1].id;
    const c = await createConversation(def);
    setCurrentConvId(c.id);
    setView("chat");
  }

  function openConversation(id: string) {
    setCurrentConvId(id);
    setView("chat");
  }

  function openSkills(draft?: any) {
    setSkillDraft(draft ?? null);
    setView("skills");
  }

  if (!bootDone) return null;

  return (
    <div className="app">
      <div className="app-shell">
        <div className="topbar app-topbar">
          <div className="panel-label">Assistant</div>
          <div className="topbar-actions">
            <button onClick={newChat} title="New chat">New</button>
            <button className={view === "chat" ? "active" : ""} onClick={() => setView("chat")}>Chat</button>
            <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History</button>
            <button className={view === "skills" ? "active" : ""} onClick={() => setView("skills")}>Skills</button>
            <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>Settings</button>
          </div>
        </div>
        <div className="main">
          {view === "chat" && currentConvId && (
            <ChatView
              conversationId={currentConvId}
              onOpenSettings={() => setView("settings")}
              onOpenSkills={openSkills}
            />
          )}
          {view === "history" && (
            <HistoryView onOpen={openConversation} currentId={currentConvId ?? undefined} />
          )}
          {view === "skills" && (
            <SkillsView initialDraft={skillDraft} onDraftConsumed={() => setSkillDraft(null)} />
          )}
          {view === "settings" && <SettingsView />}
        </div>
      </div>
    </div>
  );
}
