import Dexie from "dexie";
class SideDB extends Dexie {
    conversations;
    messages;
    notes;
    skills;
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
export async function createConversation(modelId, title = "New chat") {
    const now = Date.now();
    const conv = {
        id: crypto.randomUUID(),
        title,
        modelId,
        createdAt: now,
        updatedAt: now,
    };
    await db.conversations.add(conv);
    return conv;
}
export async function deleteConversation(id) {
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
export async function listMessages(conversationId) {
    return db.messages
        .where("[conversationId+createdAt]")
        .between([conversationId, 0], [conversationId, Infinity])
        .toArray();
}
export async function saveSkill(skill) {
    const now = Date.now();
    const normalizedTrigger = skill.trigger.trim().replace(/^\//, "").replace(/\s+/g, "-").toLowerCase();
    const next = {
        id: skill.id ?? crypto.randomUUID(),
        name: skill.name.trim(),
        trigger: normalizedTrigger,
        description: skill.description.trim(),
        prompt: skill.prompt.trim(),
        createdAt: now,
        updatedAt: now,
    };
    const existing = skill.id ? await db.skills.get(skill.id) : undefined;
    if (existing)
        next.createdAt = existing.createdAt;
    await db.skills.put(next);
    return next;
}
export async function deleteSkill(id) {
    await db.skills.delete(id);
}
