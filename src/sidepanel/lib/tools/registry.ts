import { readCurrentPage } from "./readCurrentPage";
import { getSelection } from "./getSelection";
import { fetchUrl } from "./fetchUrl";

export interface ToolDef {
  name: string;
  description: string;
  schema: { type: "object"; properties: Record<string, any>; required?: string[] };
  execute: (input: any) => Promise<string>;
}

export const TOOLS: ToolDef[] = [readCurrentPage, getSelection, fetchUrl];

export function anthropicTools(tools: ToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.schema,
  }));
}

export function openaiTools(tools: ToolDef[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.schema,
    },
  }));
}

export async function executeTool(name: string, input: any): Promise<string> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`unknown tool: ${name}`);
  return t.execute(input ?? {});
}
