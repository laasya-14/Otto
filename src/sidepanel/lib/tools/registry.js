import { readCurrentPage } from "./readCurrentPage";
import { getSelection } from "./getSelection";
import { fetchUrl } from "./fetchUrl";
export const TOOLS = [readCurrentPage, getSelection, fetchUrl];
export function anthropicTools(tools) {
    return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.schema,
    }));
}
export function openaiTools(tools) {
    return tools.map((t) => ({
        type: "function",
        function: {
            name: t.name,
            description: t.description,
            parameters: t.schema,
        },
    }));
}
export async function executeTool(name, input) {
    const t = TOOLS.find((x) => x.name === name);
    if (!t)
        throw new Error(`unknown tool: ${name}`);
    return t.execute(input ?? {});
}
