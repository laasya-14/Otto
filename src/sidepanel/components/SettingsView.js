import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../lib/keys";
import { MODELS } from "../lib/models";
import { deleteAllConversations } from "../lib/db";
export function SettingsView() {
    const [s, setS] = useState({});
    const [showA, setShowA] = useState(false);
    const [showO, setShowO] = useState(false);
    const [testA, setTestA] = useState({ state: "idle" });
    const [testO, setTestO] = useState({ state: "idle" });
    const [saved, setSaved] = useState(false);
    const [clipboardMsg, setClipboardMsg] = useState(null);
    useEffect(() => { loadSettings().then(setS); }, []);
    async function save(partial) {
        const next = { ...s, ...partial };
        setS(next);
        await saveSettings(partial);
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
    }
    async function testAnthropic() {
        if (!s.anthropicKey)
            return;
        setTestA({ state: "loading" });
        try {
            const r = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": s.anthropicKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true",
                },
                body: JSON.stringify({
                    model: "claude-haiku-4-5",
                    max_tokens: 8,
                    messages: [{ role: "user", content: "ping" }],
                }),
            });
            if (r.ok)
                setTestA({ state: "ok", msg: "Anthropic key OK" });
            else
                setTestA({ state: "err", msg: `${r.status}: ${await r.text()}` });
        }
        catch (e) {
            setTestA({ state: "err", msg: e?.message ?? String(e) });
        }
    }
    async function testOpenAI() {
        if (!s.openaiKey)
            return;
        setTestO({ state: "loading" });
        try {
            const r = await fetch("https://api.openai.com/v1/models", {
                headers: { Authorization: `Bearer ${s.openaiKey}` },
            });
            if (r.ok)
                setTestO({ state: "ok", msg: "OpenAI key OK" });
            else
                setTestO({ state: "err", msg: `${r.status}: ${await r.text()}` });
        }
        catch (e) {
            setTestO({ state: "err", msg: e?.message ?? String(e) });
        }
    }
    async function clearAll() {
        if (!confirm("Clear all chat history?"))
            return;
        if (!confirm("Really clear ALL history?"))
            return;
        await deleteAllConversations();
        alert("History cleared.");
    }
    async function pasteFromClipboard(key) {
        try {
            const text = (await navigator.clipboard.readText()).trim();
            if (!text) {
                setClipboardMsg("Clipboard is empty.");
                return;
            }
            await save({ [key]: text });
            setClipboardMsg("Pasted from clipboard.");
            setTimeout(() => setClipboardMsg(null), 1500);
        }
        catch (e) {
            setClipboardMsg(e?.message ?? "Clipboard access was blocked.");
            setTimeout(() => setClipboardMsg(null), 2200);
        }
    }
    return (_jsxs("div", { className: "settings", children: [_jsx("h2", { children: "API keys" }), _jsx("div", { className: "status", children: "Paste should work normally in these fields. The buttons are only a fallback for Chrome clipboard permission quirks." }), _jsx("label", { children: "Anthropic API key" }), _jsxs("div", { className: "row", children: [_jsx("input", { type: showA ? "text" : "password", value: s.anthropicKey ?? "", placeholder: "sk-ant-\u2026", autoComplete: "off", spellCheck: false, onChange: (e) => save({ anthropicKey: e.target.value }) }), _jsx("button", { className: "test", onClick: () => setShowA((v) => !v), children: showA ? "Hide" : "Show" }), _jsx("button", { className: "test", onClick: () => pasteFromClipboard("anthropicKey"), title: "Paste from clipboard", children: "Paste" }), _jsx("button", { className: "test", onClick: testAnthropic, disabled: !s.anthropicKey, children: "Test" })] }), testA.state !== "idle" && (_jsx("div", { className: `status ${testA.state === "ok" ? "ok" : testA.state === "err" ? "err" : ""}`, children: testA.state === "loading" ? "Testing…" : testA.msg })), _jsx("label", { children: "OpenAI API key" }), _jsxs("div", { className: "row", children: [_jsx("input", { type: showO ? "text" : "password", value: s.openaiKey ?? "", placeholder: "sk-\u2026", autoComplete: "off", spellCheck: false, onChange: (e) => save({ openaiKey: e.target.value }) }), _jsx("button", { className: "test", onClick: () => setShowO((v) => !v), children: showO ? "Hide" : "Show" }), _jsx("button", { className: "test", onClick: () => pasteFromClipboard("openaiKey"), title: "Paste from clipboard", children: "Paste" }), _jsx("button", { className: "test", onClick: testOpenAI, disabled: !s.openaiKey, children: "Test" })] }), testO.state !== "idle" && (_jsx("div", { className: `status ${testO.state === "ok" ? "ok" : testO.state === "err" ? "err" : ""}`, children: testO.state === "loading" ? "Testing…" : testO.msg })), clipboardMsg && _jsx("div", { className: "status", children: clipboardMsg }), _jsx("h2", { children: "Defaults" }), _jsx("label", { children: "Default model" }), _jsx("select", { value: s.defaultModelId ?? MODELS[1].id, onChange: (e) => save({ defaultModelId: e.target.value }), children: MODELS.map((m) => _jsx("option", { value: m.id, children: m.label }, m.id)) }), _jsx("h2", { children: "Shortcuts" }), _jsxs("div", { className: "status", children: ["\u2318\u21E7L \u2014 open Side, attach current selection", _jsx("br", {}), "\u2318\u21E7U \u2014 attach current page", _jsx("br", {}), "Rebind at ", _jsx("code", { children: "chrome://extensions/shortcuts" }), "."] }), _jsx("h2", { children: "Data" }), _jsx("button", { className: "danger", onClick: clearAll, children: "Clear all chat history" }), _jsxs("div", { className: "status", style: { marginTop: 10 }, children: ["Keys are stored in ", _jsx("code", { children: "chrome.storage.local" }), " on this device only. ", saved && "Saved."] })] }));
}
