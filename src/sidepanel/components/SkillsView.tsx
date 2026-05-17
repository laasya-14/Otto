import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Skill } from "../../shared/types";
import { db, deleteSkill, saveSkill } from "../lib/db";
import { generateSkillDraft, refineSkillPrompt } from "../lib/skills";

interface Props {
  initialDraft?: Partial<Skill> | null;
  onDraftConsumed?: () => void;
}

const EMPTY_FORM = {
  id: undefined as string | undefined,
  name: "",
  trigger: "",
  description: "",
  prompt: "",
};

export function SkillsView({ initialDraft, onDraftConsumed }: Props) {
  const skills = useLiveQuery(() => db.skills.orderBy("updatedAt").reverse().toArray(), []);
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "refine" | "save" | null>(null);
  const [refineRequest, setRefineRequest] = useState("");

  useEffect(() => {
    if (!initialDraft) return;
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
    if (form.id || initialDraft) return;
    if (skills && skills.length > 0 && !form.name && !form.description && !form.prompt) {
      const first = skills[0];
      loadSkill(first);
    }
  }, [skills]);

  const currentSkill = useMemo<Skill | null>(() => {
    if (!form.id) return null;
    return skills?.find((skill) => skill.id === form.id) ?? null;
  }, [form.id, skills]);

  function loadSkill(skill: Skill) {
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
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
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
      const base: Skill = {
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
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
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
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    if (!confirm(`Delete /${form.trigger}?`)) return;
    await deleteSkill(form.id);
    resetForm();
  }

  return (
    <div className="skills-view">
      <div className="skills-list">
        <div className="skills-list-header">
          <div>Saved skills</div>
          <button type="button" className="test" onClick={resetForm}>New</button>
        </div>
        <div className="skills-list-items">
          {(skills ?? []).length === 0 && <div className="empty">No saved skills.</div>}
          {skills?.map((skill) => (
            <button
              type="button"
              key={skill.id}
              className={`skill-row${form.id === skill.id ? " active" : ""}`}
              onClick={() => loadSkill(skill)}
            >
              <span className="skill-trigger">/{skill.trigger}</span>
              <span className="skill-name">{skill.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="skills-editor">
        <div className="skills-card">
          <div className="skills-card-title">Skill details</div>
          <div className="skills-grid">
            <div>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Summarize page" />
            </div>
            <div>
              <label>Slash trigger</label>
              <input value={form.trigger} onChange={(e) => setForm((s) => ({ ...s, trigger: e.target.value.replace(/^\//, "") }))} placeholder="summarize" />
            </div>
          </div>

          <label>Description</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            placeholder="Explain what this skill should do when selected from /."
          />

          <div className="skills-actions">
            <button type="button" className="test" onClick={handleGenerate} disabled={busy !== null}>
              {busy === "generate" ? "Generating…" : "Generate prompt"}
            </button>
            <button type="button" className="test" onClick={handleSave} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save skill"}
            </button>
            {form.id && (
              <button type="button" className="danger" onClick={handleDelete}>Delete</button>
            )}
          </div>
        </div>

        <div className="skills-card">
          <div className="skills-card-title">Prompt</div>
          <label>Prompt text</label>
          <textarea
            rows={10}
            value={form.prompt}
            onChange={(e) => setForm((s) => ({ ...s, prompt: e.target.value }))}
            placeholder="This exact prompt will be sent when the slash skill is selected."
          />
        </div>

        <div className="skills-card">
          <div className="skills-card-title">Refine with AI</div>
          <label>Change request</label>
          <textarea
            rows={3}
            value={refineRequest}
            onChange={(e) => setRefineRequest(e.target.value)}
            placeholder="Example: make it stricter, ask for bullet points, preserve tone, include page context."
          />
          <div className="skills-actions">
            <button type="button" className="test" onClick={handleRefine} disabled={busy !== null}>
              {busy === "refine" ? "Refining…" : "Refine prompt"}
            </button>
          </div>
        </div>

        {status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
