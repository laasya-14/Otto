import { useEffect, useState } from "react";
import { loadSettings, saveSettings, type Settings } from "../lib/keys";
import { MODELS } from "../lib/models";
import { deleteAllConversations } from "../lib/db";

type TestState = { state: "idle" | "ok" | "err" | "loading"; msg?: string };

export function SettingsView() {
  const [s, setS] = useState<Settings>({});
  const [showA, setShowA] = useState(false);
  const [showO, setShowO] = useState(false);
  const [testA, setTestA] = useState<TestState>({ state: "idle" });
  const [testO, setTestO] = useState<TestState>({ state: "idle" });
  const [saved, setSaved] = useState(false);
  const [clipboardMsg, setClipboardMsg] = useState<string | null>(null);

  useEffect(() => { loadSettings().then(setS); }, []);

  async function save(partial: Settings) {
    const next = { ...s, ...partial };
    setS(next);
    await saveSettings(partial);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  async function testAnthropic() {
    if (!s.anthropicKey) return;
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
      if (r.ok) setTestA({ state: "ok", msg: "Anthropic key OK" });
      else setTestA({ state: "err", msg: `${r.status}: ${await r.text()}` });
    } catch (e: any) {
      setTestA({ state: "err", msg: e?.message ?? String(e) });
    }
  }

  async function testOpenAI() {
    if (!s.openaiKey) return;
    setTestO({ state: "loading" });
    try {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${s.openaiKey}` },
      });
      if (r.ok) setTestO({ state: "ok", msg: "OpenAI key OK" });
      else setTestO({ state: "err", msg: `${r.status}: ${await r.text()}` });
    } catch (e: any) {
      setTestO({ state: "err", msg: e?.message ?? String(e) });
    }
  }

  async function clearAll() {
    if (!confirm("Clear all chat history?")) return;
    if (!confirm("Really clear ALL history?")) return;
    await deleteAllConversations();
    alert("History cleared.");
  }

  async function pasteFromClipboard(key: "anthropicKey" | "openaiKey") {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setClipboardMsg("Clipboard is empty.");
        return;
      }
      await save({ [key]: text });
      setClipboardMsg("Pasted from clipboard.");
      setTimeout(() => setClipboardMsg(null), 1500);
    } catch (e: any) {
      setClipboardMsg(e?.message ?? "Clipboard access was blocked.");
      setTimeout(() => setClipboardMsg(null), 2200);
    }
  }

  return (
    <div className="settings">
      <h2>API keys</h2>
      <div className="status">
        Paste should work normally in these fields. The buttons are only a fallback for Chrome clipboard permission quirks.
      </div>

      <label>Anthropic API key</label>
      <div className="row">
        <input
          type={showA ? "text" : "password"}
          value={s.anthropicKey ?? ""}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => save({ anthropicKey: e.target.value })}
        />
        <button className="test" onClick={() => setShowA((v) => !v)}>{showA ? "Hide" : "Show"}</button>
        <button
          className="test"
          onClick={() => pasteFromClipboard("anthropicKey")}
          title="Paste from clipboard"
        >Paste</button>
        <button className="test" onClick={testAnthropic} disabled={!s.anthropicKey}>Test</button>
      </div>
      {testA.state !== "idle" && (
        <div className={`status ${testA.state === "ok" ? "ok" : testA.state === "err" ? "err" : ""}`}>
          {testA.state === "loading" ? "Testing…" : testA.msg}
        </div>
      )}

      <label>OpenAI API key</label>
      <div className="row">
        <input
          type={showO ? "text" : "password"}
          value={s.openaiKey ?? ""}
          placeholder="sk-…"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => save({ openaiKey: e.target.value })}
        />
        <button className="test" onClick={() => setShowO((v) => !v)}>{showO ? "Hide" : "Show"}</button>
        <button
          className="test"
          onClick={() => pasteFromClipboard("openaiKey")}
          title="Paste from clipboard"
        >Paste</button>
        <button className="test" onClick={testOpenAI} disabled={!s.openaiKey}>Test</button>
      </div>
      {testO.state !== "idle" && (
        <div className={`status ${testO.state === "ok" ? "ok" : testO.state === "err" ? "err" : ""}`}>
          {testO.state === "loading" ? "Testing…" : testO.msg}
        </div>
      )}
      {clipboardMsg && <div className="status">{clipboardMsg}</div>}

      <h2>Defaults</h2>
      <label>Default model</label>
      <select
        value={s.defaultModelId ?? MODELS[1].id}
        onChange={(e) => save({ defaultModelId: e.target.value })}
      >
        {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>

      <h2>Shortcuts</h2>
      <div className="status">
        ⌘⇧L — open Side, attach current selection<br/>
        ⌘⇧U — attach current page<br/>
        Rebind at <code>chrome://extensions/shortcuts</code>.
      </div>

      <h2>Data</h2>
      <button className="danger" onClick={clearAll}>Clear all chat history</button>

      <div className="status" style={{ marginTop: 10 }}>
        Keys are stored in <code>chrome.storage.local</code> on this device only. {saved && "Saved."}
      </div>
    </div>
  );
}
