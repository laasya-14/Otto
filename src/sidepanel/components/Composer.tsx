import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Attachment } from "../../shared/types";
import { db } from "../lib/db";
import { bgGetPage, bgGetSelection, fetchFocusComposer, onFocusComposer, getActiveTab } from "../lib/messaging";

function isYouTubeWatchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname === "/watch" &&
      Boolean(u.searchParams.get("v"))
    );
  } catch {
    return false;
  }
}

interface Props {
  pendingAttachments: Attachment[];
  freshIdx?: number | null;
  setPendingAttachments: Dispatch<SetStateAction<Attachment[]>>;
  onSend: (text: string, attachments: Attachment[]) => void;
  onOpenSkills: (draft?: any) => void;
  disabled?: boolean;
}

export function Composer({ pendingAttachments, freshIdx, setPendingAttachments, onSend, onOpenSkills, disabled }: Props) {
  const [text, setText] = useState("");
  const [attachError, setAttachError] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [activeTabIsYouTube, setActiveTabIsYouTube] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const focusBurstRef = useRef<number | null>(null);
  const skills = useLiveQuery(() => db.skills.orderBy("trigger").toArray(), []);

  function focusComposer() {
    const el = ref.current;
    if (!el) return;
    window.focus();
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
    el.scrollIntoView({ block: "nearest" });
  }

  function focusComposerBurst(durationMs = 1200) {
    if (focusBurstRef.current != null) {
      window.clearInterval(focusBurstRef.current);
      focusBurstRef.current = null;
    }
    focusComposer();
    const startedAt = Date.now();
    focusBurstRef.current = window.setInterval(() => {
      focusComposer();
      if (Date.now() - startedAt >= durationMs) {
        if (focusBurstRef.current != null) {
          window.clearInterval(focusBurstRef.current);
          focusBurstRef.current = null;
        }
      }
    }, 80);
  }

  useEffect(() => {
    const id = window.setTimeout(focusComposerBurst, 0);
    return () => {
      window.clearTimeout(id);
      if (focusBurstRef.current != null) window.clearInterval(focusBurstRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getActiveTab().then((tab) => {
      if (!cancelled && tab?.url) setActiveTabIsYouTube(isYouTubeWatchUrl(tab.url));
    });
    const handler = () => {
      getActiveTab().then((tab) => {
        if (!cancelled && tab?.url) setActiveTabIsYouTube(isYouTubeWatchUrl(tab.url));
      });
    };
    chrome.tabs?.onActivated?.addListener(handler);
    chrome.tabs?.onUpdated?.addListener(handler);
    return () => {
      cancelled = true;
      chrome.tabs?.onActivated?.removeListener(handler);
      chrome.tabs?.onUpdated?.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    if (pendingAttachments.length === 0) return;
    const id = window.setTimeout(focusComposerBurst, 0);
    return () => window.clearTimeout(id);
  }, [pendingAttachments.length]);

  useEffect(() => {
    const handleWindowFocus = () => focusComposerBurst();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") focusComposerBurst();
    };
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("select, button, input, textarea, a, [role='button'], [role='menuitem'], [contenteditable='true']")) {
        return;
      }
      focusComposerBurst(400);
    };
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pointerdown", handlePointerDown);
    const off = onFocusComposer(() => focusComposerBurst());
    fetchFocusComposer().then((at) => {
      if (at) focusComposerBurst();
    });
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pointerdown", handlePointerDown);
      off();
    };
  }, []);

  function removeAttachment(i: number) {
    setPendingAttachments((current) => current.filter((_, idx) => idx !== i));
  }

  function mergeAttachment(next: Attachment) {
    setPendingAttachments((current) => {
      const existing = current.findIndex(
        (item) => item.kind === next.kind && item.url === next.url && item.text === next.text
      );
      if (existing >= 0) return current;
      return [...current, next];
    });
  }

  async function attachCurrentPage() {
    setAttachError(null);
    const p = await bgGetPage();
    if (p?.pageText) {
      mergeAttachment({ kind: "page", url: p.url, title: p.title, text: p.pageText });
    } else {
      setAttachError("Couldn't read the current page. Reload the tab and try again.");
    }
  }

  async function attachSelection() {
    setAttachError(null);
    const s = await bgGetSelection();
    if (s?.selection?.trim()) {
      mergeAttachment({ kind: "selection", url: s.url, title: s.title, text: s.selection });
    } else {
      setAttachError("No selected text was found in the active tab.");
    }
  }

  async function attachYouTubeVideo() {
    setAttachError(null);
    const tab = await getActiveTab();
    if (!tab?.url || !isYouTubeWatchUrl(tab.url)) {
      setAttachError("Current tab is not a YouTube video. Navigate to a youtube.com/watch?v=… page.");
      return;
    }
    mergeAttachment({
      kind: "video_url",
      url: tab.url,
      title: tab.title,
      text: tab.url,
    });
  }

  function submit() {
    const t = text.trim();
    if (!t && pendingAttachments.length === 0) return;
    onSend(t, pendingAttachments);
    setText("");
    setPendingAttachments([]);
    setAttachError(null);
    window.setTimeout(focusComposerBurst, 0);
  }

  const slashQuery = useMemo(() => {
    const trimmedStart = text.trimStart();
    if (!trimmedStart.startsWith("/")) return null;
    const firstLine = trimmedStart.split("\n")[0];
    if (firstLine.includes(" ")) return null;
    return firstLine.slice(1).toLowerCase();
  }, [text]);

  const slashItems = useMemo(() => {
    if (slashQuery == null) return [];
    const saved = (skills ?? [])
      .filter((skill) =>
        !slashQuery ||
        skill.trigger.toLowerCase().includes(slashQuery) ||
        skill.name.toLowerCase().includes(slashQuery)
      )
      .map((skill) => ({
        key: skill.id,
        title: `/${skill.trigger}`,
        subtitle: skill.name,
        action: () => {
          onSend(skill.prompt, pendingAttachments);
          setText("");
          setPendingAttachments([]);
          setAttachError(null);
          window.setTimeout(focusComposerBurst, 0);
        },
      }));
    saved.push({
      key: "create-skill",
      title: "/create-skill",
      subtitle: "Create a saved prompt skill",
      action: () => {
        onOpenSkills({
          trigger: slashQuery || "",
          name: "",
          description: text.replace(/^\//, "").trim(),
          prompt: "",
        });
      },
    });
    return saved;
  }, [skills, slashQuery, text, pendingAttachments]);

  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery, slashItems.length]);

  function activateSlashItem(index: number) {
    const item = slashItems[index];
    if (!item) return;
    item.action();
  }

  return (
    <div className="composer">
      {pendingAttachments.length > 0 && (
        <div className="chips">
          {pendingAttachments.map((a, i) => (
            <span
              key={`${a.kind}:${a.url ?? ""}:${i}`}
              className={`chip chip-${a.kind}${i === freshIdx ? " fresh" : ""}`}
              title={a.kind === "video_url" ? (a.url ?? "") : a.text.slice(0, 280)}
            >
              <span className="chip-label">
                {a.kind === "page" ? "Page" : a.kind === "selection" ? "Selection" : a.kind === "video_url" ? "▶ Video" : a.kind}
              </span>
              <span className="chip-title">
                {a.kind === "selection"
                  ? a.text.replace(/\s+/g, " ").slice(0, 72)
                  : (a.title ?? a.url ?? "").slice(0, 52)}
              </span>
              <button type="button" aria-label={`Remove ${a.kind} attachment`} onClick={() => removeAttachment(i)}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="row">
        <div className="composer-input-wrap">
          <textarea
            ref={ref}
            rows={2}
            value={text}
            placeholder="Ask about this page…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (slashItems.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIndex((current) => Math.min(current + 1, slashItems.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIndex((current) => Math.max(current - 1, 0));
                  return;
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  activateSlashItem(slashIndex);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (slashItems.length > 0 && slashQuery !== null) {
                  activateSlashItem(slashIndex);
                  return;
                }
                if (!disabled) submit();
              }
            }}
          />
          {slashItems.length > 0 && (
            <div className="slash-menu">
              {slashItems.map((item, index) => (
                <button
                  type="button"
                  key={item.key}
                  className={`slash-item${index === slashIndex ? " active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activateSlashItem(index)}
                >
                  <span className="slash-title">{item.title}</span>
                  <span className="slash-subtitle">{item.subtitle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="send" disabled={disabled} onClick={submit}>Send</button>
      </div>
      <div className="actions">
        <button type="button" onClick={attachSelection}>Add selection</button>
        <button type="button" onClick={attachCurrentPage}>Add page</button>
        {activeTabIsYouTube && (
          <button type="button" className="action-youtube" onClick={attachYouTubeVideo}>▶ Attach video</button>
        )}
        <span style={{ marginLeft: "auto" }}>/ skills · ⌘⇧L</span>
      </div>
      {attachError && <div className="composer-note composer-note-err">{attachError}</div>}
    </div>
  );
}
