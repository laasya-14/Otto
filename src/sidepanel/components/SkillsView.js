import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteSkill, saveSkill } from "../lib/db";
import { generateSkillDraft, refineSkillPrompt } from "../lib/skills";
const EMPTY_FORM = {
    id: undefined,
    name: "",
    trigger: "",
    description: "",
    prompt: "",
};
export function SkillsView({ initialDraft, onDraftConsumed }) {
    const skills = useLiveQuery(() => db.skills.orderBy("updatedAt").reverse().toArray(), []);
    const [form, setForm] = useState(EMPTY_FORM);
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(null);
    const [refineRequest, setRefineRequest] = useState("");
    useEffect(() => {
        if (!initialDraft)
            return;
        setForm({
            id: initialDraft.id,
            name: initialDraft.name ?? "",
            trigger: initialDraft.trigger ?? "",
            description: initialDraft.description ?? "",
            prompt: initialDraft.prompt ?? "",
        });
        onDraftConsumed?.();
    }, [initialDraft, onDraftConsumed]);
    useEffect(() => {
        if (form.id || initialDraft)
            return;
        if (skills && skills.length > 0 && !form.name && !form.description && !form.prompt) {
            const first = skills[0];
            loadSkill(first);
        }
    }, [skills]);
    const currentSkill = useMemo(() => {
        if (!form.id)
            return null;
        return skills?.find((skill) => skill.id === form.id) ?? null;
    }, [form.id, skills]);
    function loadSkill(skill) {
        setForm({
            id: skill.id,
            name: skill.name,
            trigger: skill.trigger,
            description: skill.description,
            prompt: skill.prompt,
        });
        setRefineRequest("");
        setStatus(null);
    }
    function resetForm() {
        setForm(EMPTY_FORM);
        setRefineRequest("");
        setStatus(null);
    }
    async function handleGenerate() {
        if (!form.description.trim()) {
            setStatus("Add a short description first.");
            return;
        }
        setBusy("generate");
        setStatus(null);
        try {
            const draft = await generateSkillDraft({ name: form.name, description: form.description });
            setForm((current) => ({
                ...current,
                name: draft.name || current.name,
                trigger: draft.trigger || current.trigger,
                prompt: draft.prompt || current.prompt,
            }));
            setStatus("Prompt generated.");
        }
        catch (e) {
            setStatus(e?.message ?? String(e));
        }
        finally {
            setBusy(null);
        }
    }
    async function handleRefine() {
        if (!currentSkill && !form.prompt.trim()) {
            setStatus("Generate or write a prompt first.");
            return;
        }
        if (!refineRequest.trim()) {
            setStatus("Describe the prompt change you want.");
            return;
        }
        setBusy("refine");
        setStatus(null);
        try {
            const base = {
                id: form.id ?? "draft",
                name: form.name,
                trigger: form.trigger,
                description: form.description,
                prompt: form.prompt,
                createdAt: 0,
                updatedAt: 0,
            };
            const refined = await refineSkillPrompt({ skill: base, changeRequest: refineRequest });
            setForm((current) => ({
                ...current,
                name: refined.name || current.name,
                trigger: refined.trigger || current.trigger,
                prompt: refined.prompt || current.prompt,
            }));
            setStatus("Prompt refined.");
        }
        catch (e) {
            setStatus(e?.message ?? String(e));
        }
        finally {
            setBusy(null);
        }
    }
    async function handleSave() {
        if (!form.name.trim() || !form.trigger.trim() || !form.prompt.trim()) {
            setStatus("Name, slash trigger, and prompt are required.");
            return;
        }
        setBusy("save");
        setStatus(null);
        try {
            const saved = await saveSkill(form);
            loadSkill(saved);
            setStatus(`Saved /${saved.trigger}.`);
        }
        catch (e) {
            setStatus(e?.message ?? String(e));
        }
        finally {
            setBusy(null);
        }
    }
    async function handleDelete() {
        if (!form.id)
            return;
        if (!confirm(`Delete /${form.trigger}?`))
            return;
        await deleteSkill(form.id);
        resetForm();
    }
    return (_jsxs("div", { className: "skills-view", children: [_jsxs("div", { className: "skills-list", children: [_jsxs("div", { className: "skills-list-header", children: [_jsx("div", { children: "Saved skills" }), _jsx("button", { type: "button", className: "test", onClick: resetForm, children: "New" })] }), _jsxs("div", { className: "skills-list-items", children: [(skills ?? []).length === 0 && _jsx("div", { className: "empty", children: "No saved skills." }), skills?.map((skill) => (_jsxs("button", { type: "button", className: `skill-row${form.id === skill.id ? " active" : ""}`, onClick: () => loadSkill(skill), children: [_jsxs("span", { className: "skill-trigger", children: ["/", skill.trigger] }), _jsx("span", { className: "skill-name", children: skill.name })] }, skill.id)))] })] }), _jsxs("div", { className: "skills-editor", children: [_jsxs("div", { className: "skills-card", children: [_jsx("div", { className: "skills-card-title", children: "Skill details" }), _jsxs("div", { className: "skills-grid", children: [_jsxs("div", { children: [_jsx("label", { children: "Name" }), _jsx("input", { value: form.name, onChange: (e) => setForm((s) => ({ ...s, name: e.target.value })), placeholder: "Summarize page" })] }), _jsxs("div", { children: [_jsx("label", { children: "Slash trigger" }), _jsx("input", { value: form.trigger, onChange: (e) => setForm((s) => ({ ...s, trigger: e.target.value.replace(/^\//, "") })), placeholder: "summarize" })] })] }), _jsx("label", { children: "Description" }), _jsx("textarea", { rows: 4, value: form.description, onChange: (e) => setForm((s) => ({ ...s, description: e.target.value })), placeholder: "Explain what this skill should do when selected from /." }), _jsxs("div", { className: "skills-actions", children: [_jsx("button", { type: "button", className: "test", onClick: handleGenerate, disabled: busy !== null, children: busy === "generate" ? "Generating…" : "Generate prompt" }), _jsx("button", { type: "button", className: "test", onClick: handleSave, disabled: busy !== null, children: busy === "save" ? "Saving…" : "Save skill" }), form.id && (_jsx("button", { type: "button", className: "danger", onClick: handleDelete, children: "Delete" }))] })] }), _jsxs("div", { className: "skills-card", children: [_jsx("div", { className: "skills-card-title", children: "Prompt" }), _jsx("label", { children: "Prompt text" }), _jsx("textarea", { rows: 10, value: form.prompt, onChange: (e) => setForm((s) => ({ ...s, prompt: e.target.value })), placeholder: "This exact prompt will be sent when the slash skill is selected." })] }), _jsxs("div", { className: "skills-card", children: [_jsx("div", { className: "skills-card-title", children: "Refine with AI" }), _jsx("label", { children: "Change request" }), _jsx("textarea", { rows: 3, value: refineRequest, onChange: (e) => setRefineRequest(e.target.value), placeholder: "Example: make it stricter, ask for bullet points, preserve tone, include page context." }), _jsx("div", { className: "skills-actions", children: _jsx("button", { type: "button", className: "test", onClick: handleRefine, disabled: busy !== null, children: busy === "refine" ? "Refining…" : "Refine prompt" }) })] }), status && _jsx("div", { className: "status", children: status })] })] }));
}
