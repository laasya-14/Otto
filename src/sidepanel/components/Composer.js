import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { bgGetPage, bgGetSelection, fetchFocusComposer, onFocusComposer } from "../lib/messaging";
export function Composer({ pendingAttachments, freshIdx, setPendingAttachments, onSend, onOpenSkills, disabled }) {
    const [text, setText] = useState("");
    const [attachError, setAttachError] = useState(null);
    const [slashIndex, setSlashIndex] = useState(0);
    const ref = useRef(null);
    const focusBurstRef = useRef(null);
    const skills = useLiveQuery(() => db.skills.orderBy("trigger").toArray(), []);
    function focusComposer() {
        const el = ref.current;
        if (!el)
            return;
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
            if (focusBurstRef.current != null)
                window.clearInterval(focusBurstRef.current);
        };
    }, []);
    useEffect(() => {
        if (pendingAttachments.length === 0)
            return;
        const id = window.setTimeout(focusComposerBurst, 0);
        return () => window.clearTimeout(id);
    }, [pendingAttachments.length]);
    useEffect(() => {
        const handleWindowFocus = () => focusComposerBurst();
        const handleVisibility = () => {
            if (document.visibilityState === "visible")
                focusComposerBurst();
        };
        const handlePointerDown = () => focusComposerBurst(400);
        window.addEventListener("focus", handleWindowFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("pointerdown", handlePointerDown);
        const off = onFocusComposer(() => focusComposerBurst());
        fetchFocusComposer().then((at) => {
            if (at)
                focusComposerBurst();
        });
        return () => {
            window.removeEventListener("focus", handleWindowFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("pointerdown", handlePointerDown);
            off();
        };
    }, []);
    function removeAttachment(i) {
        setPendingAttachments((current) => current.filter((_, idx) => idx !== i));
    }
    function mergeAttachment(next) {
        setPendingAttachments((current) => {
            const existing = current.findIndex((item) => item.kind === next.kind && item.url === next.url && item.text === next.text);
            if (existing >= 0)
                return current;
            return [...current, next];
        });
    }
    async function attachCurrentPage() {
        setAttachError(null);
        const p = await bgGetPage();
        if (p?.pageText) {
            mergeAttachment({ kind: "page", url: p.url, title: p.title, text: p.pageText });
        }
        else {
            setAttachError("Couldn't read the current page. Reload the tab and try again.");
        }
    }
    async function attachSelection() {
        setAttachError(null);
        const s = await bgGetSelection();
        if (s?.selection?.trim()) {
            mergeAttachment({ kind: "selection", url: s.url, title: s.title, text: s.selection });
        }
        else {
            setAttachError("No selected text was found in the active tab.");
        }
    }
    function submit() {
        const t = text.trim();
        if (!t && pendingAttachments.length === 0)
            return;
        onSend(t, pendingAttachments);
        setText("");
        setPendingAttachments([]);
        setAttachError(null);
        window.setTimeout(focusComposerBurst, 0);
    }
    const slashQuery = useMemo(() => {
        const trimmedStart = text.trimStart();
        if (!trimmedStart.startsWith("/"))
            return null;
        const firstLine = trimmedStart.split("\n")[0];
        if (firstLine.includes(" "))
            return null;
        return firstLine.slice(1).toLowerCase();
    }, [text]);
    const slashItems = useMemo(() => {
        if (slashQuery == null)
            return [];
        const saved = (skills ?? [])
            .filter((skill) => !slashQuery ||
            skill.trigger.toLowerCase().includes(slashQuery) ||
            skill.name.toLowerCase().includes(slashQuery))
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
    function activateSlashItem(index) {
        const item = slashItems[index];
        if (!item)
            return;
        item.action();
    }
    return (_jsxs("div", { className: "composer", children: [pendingAttachments.length > 0 && (_jsx("div", { className: "chips", children: pendingAttachments.map((a, i) => (_jsxs("span", { className: `chip chip-${a.kind}${i === freshIdx ? " fresh" : ""}`, title: a.text.slice(0, 280), children: [_jsx("span", { className: "chip-label", children: a.kind === "page" ? "Page context" : "Selected text" }), _jsx("span", { className: "chip-title", children: a.kind === "selection"
                                ? a.text.replace(/\s+/g, " ").slice(0, 72)
                                : (a.title ?? a.url ?? "").slice(0, 52) }), _jsx("button", { type: "button", "aria-label": `Remove ${a.kind} attachment`, onClick: () => removeAttachment(i), children: "\u00D7" })] }, `${a.kind}:${a.url ?? ""}:${i}`))) })), _jsxs("div", { className: "row", children: [_jsxs("div", { className: "composer-input-wrap", children: [_jsx("textarea", { ref: ref, rows: 2, value: text, placeholder: "Ask about this page\u2026", onChange: (e) => setText(e.target.value), onKeyDown: (e) => {
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
                                        if (!disabled)
                                            submit();
                                    }
                                } }), slashItems.length > 0 && (_jsx("div", { className: "slash-menu", children: slashItems.map((item, index) => (_jsxs("button", { type: "button", className: `slash-item${index === slashIndex ? " active" : ""}`, onMouseDown: (e) => e.preventDefault(), onClick: () => activateSlashItem(index), children: [_jsx("span", { className: "slash-title", children: item.title }), _jsx("span", { className: "slash-subtitle", children: item.subtitle })] }, item.key))) }))] }), _jsx("button", { className: "send", disabled: disabled, onClick: submit, children: "Send" })] }), _jsxs("div", { className: "actions", children: [_jsx("button", { type: "button", onClick: attachSelection, children: "Add selected text" }), _jsx("button", { type: "button", onClick: attachCurrentPage, children: "Add page context" }), _jsx("span", { style: { marginLeft: "auto" }, children: "/ for skills \u00B7 \u2318\u21E7L selection + page" })] }), attachError && _jsx("div", { className: "composer-note composer-note-err", children: attachError })] }));
}
