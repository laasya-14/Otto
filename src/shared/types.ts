export type Role = "user" | "assistant" | "system" | "tool";

export type Provider = "anthropic" | "openai" | "google";

export interface ModelInfo {
  id: string;
  label: string;
  provider: Provider;
  contextWindow: number;
  supportsVision?: boolean;
}

export interface Attachment {
  kind: "selection" | "page" | "tool_result" | "video_url";
  url?: string;
  title?: string;
  text: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  summary?: string;
  summaryThroughMessageId?: string;
}

export interface Skill {
  id: string;
  name: string;
  trigger: string;
  description: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface PageExtract {
  url: string;
  title: string;
  selection?: string;
  pageText?: string;
  truncated?: boolean;
}

export type BgMessage =
  | { type: "GET_SELECTION" }
  | { type: "GET_PAGE" }
  | { type: "FETCH_PENDING_CONTEXT" };

export type PendingContext = {
  items: Array<{
    kind: "selection" | "page";
    payload: PageExtract;
  }>;
  at: number;
};
