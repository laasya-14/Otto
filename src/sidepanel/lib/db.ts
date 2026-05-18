import Dexie, { type Table } from "dexie";
import type { Conversation, Message, OpenAIReasoningEffort, Skill } from "../../shared/types";

export interface Note {
  id: string;
  body: string;
  createdAt: number;
}

class SideDB extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  notes!: Table<Note, string>;
  skills!: Table<Skill, string>;

  constructor() {
    super("side-db");
    this.version(1).stores({
      conversations: "id, updatedAt, title",
      messages: "id, conversationId, createdAt, [conversationId+createdAt]",
      notes: "id, createdAt",
    });
    this.version(2).stores({
      conversations: "id, updatedAt, title",
      messages: "id, conversationId, createdAt, [conversationId+createdAt]",
      notes: "id, createdAt",
      skills: "id, trigger, updatedAt, name",
    });
  }
}

export const db = new SideDB();

export async function createConversation(
  modelId: string,
  reasoningEffort?: OpenAIReasoningEffort,
  title = "New chat"
): Promise<Conversation> {
  const now = Date.now();
  const conv: Conversation = {
    id: crypto.randomUUID(),
    title,
    modelId,
    reasoningEffort,
    createdAt: now,
    updatedAt: now,
  };
  await db.conversations.add(conv);
  return conv;
}

export async function deleteConversation(id: string) {
  await db.transaction("rw", db.conversations, db.messages, async () => {
    await db.messages.where("conversationId").equals(id).delete();
    await db.conversations.delete(id);
  });
}

export async function deleteAllConversations() {
  await db.transaction("rw", db.conversations, db.messages, async () => {
    await db.messages.clear();
    await db.conversations.clear();
  });
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  return db.messages
    .where("[conversationId+createdAt]")
    .between([conversationId, 0], [conversationId, Infinity])
    .toArray();
}

export async function saveSkill(skill: Omit<Skill, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const now = Date.now();
  const normalizedTrigger = skill.trigger.trim().replace(/^\//, "").replace(/\s+/g, "-").toLowerCase();
  const next: Skill = {
    id: skill.id ?? crypto.randomUUID(),
    name: skill.name.trim(),
    trigger: normalizedTrigger,
    description: skill.description.trim(),
    prompt: skill.prompt.trim(),
    createdAt: now,
    updatedAt: now,
  };
  const existing = skill.id ? await db.skills.get(skill.id) : undefined;
  if (existing) next.createdAt = existing.createdAt;
  await db.skills.put(next);
  return next;
}

export async function deleteSkill(id: string) {
  await db.skills.delete(id);
}
