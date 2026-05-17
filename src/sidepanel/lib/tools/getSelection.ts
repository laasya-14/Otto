import type { ToolDef } from "./registry";
import { bgGetSelection } from "../messaging";

export const getSelection: ToolDef = {
  name: "get_selection",
  description:
    "Get the user's current text selection on the active browser tab. Returns empty if nothing is selected.",
  schema: { type: "object", properties: {} },
  execute: async () => {
    const r = await bgGetSelection();
    if (!r) return "No active tab.";
    return r.selection?.trim() || "(no selection)";
  },
};
