import type { ToolDef } from "./registry";
import { bgGetPage } from "../messaging";

export const readCurrentPage: ToolDef = {
  name: "read_current_page",
  description:
    "Read the main text content of the user's current active browser tab using Readability. Use this when you need page context and none is attached.",
  schema: { type: "object", properties: {} },
  execute: async () => {
    const r = await bgGetPage();
    if (!r) return "Could not read the current page (no active tab or not accessible).";
    return `URL: ${r.url}\nTitle: ${r.title}\n\n${r.pageText ?? ""}${r.truncated ? "\n\n[truncated]" : ""}`;
  },
};
