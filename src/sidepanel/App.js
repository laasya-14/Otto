import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { ChatView } from "./components/ChatView";
import { HistoryView } from "./components/HistoryView";
import { SkillsView } from "./components/SkillsView";
import { SettingsView } from "./components/SettingsView";
import { createConversation, db } from "./lib/db";
import { loadSettings } from "./lib/keys";
import { MODELS } from "./lib/models";
export function App() {
    const [view, setView] = useState("chat");
    const [currentConvId, setCurrentConvId] = useState(null);
    const [bootDone, setBootDone] = useState(false);
    const [skillDraft, setSkillDraft] = useState(null);
    useEffect(() => {
        (async () => {
            const settings = await loadSettings();
            const last = await db.conversations.orderBy("updatedAt").last();
            if (last) {
                setCurrentConvId(last.id);
            }
            else {
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
    function openConversation(id) {
        setCurrentConvId(id);
        setView("chat");
    }
    function openSkills(draft) {
        setSkillDraft(draft ?? null);
        setView("skills");
    }
    if (!bootDone)
        return null;
    return (_jsx("div", { className: "app", children: _jsxs("div", { className: "app-shell", children: [_jsxs("div", { className: "topbar app-topbar", children: [_jsx("div", { className: "panel-label", children: "Assistant" }), _jsxs("div", { className: "topbar-actions", children: [_jsx("button", { onClick: newChat, title: "New chat", children: "New" }), _jsx("button", { className: view === "chat" ? "active" : "", onClick: () => setView("chat"), children: "Chat" }), _jsx("button", { className: view === "history" ? "active" : "", onClick: () => setView("history"), children: "History" }), _jsx("button", { className: view === "skills" ? "active" : "", onClick: () => setView("skills"), children: "Skills" }), _jsx("button", { className: view === "settings" ? "active" : "", onClick: () => setView("settings"), children: "Settings" })] })] }), _jsxs("div", { className: "main", children: [view === "chat" && currentConvId && (_jsx(ChatView, { conversationId: currentConvId, onOpenSettings: () => setView("settings"), onOpenSkills: openSkills })), view === "history" && (_jsx(HistoryView, { onOpen: openConversation, currentId: currentConvId ?? undefined })), view === "skills" && (_jsx(SkillsView, { initialDraft: skillDraft, onDraftConsumed: () => setSkillDraft(null) })), view === "settings" && _jsx(SettingsView, {})] })] }) }));
}
