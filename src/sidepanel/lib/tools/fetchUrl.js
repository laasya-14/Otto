const MAX_CHARS = 50000;
export const fetchUrl = {
    name: "fetch_url",
    description: "Fetch a URL and return its visible text content. Use this to follow links the user mentions or to gather additional context.",
    schema: {
        type: "object",
        properties: {
            url: { type: "string", description: "The absolute URL to fetch (must start with http or https)." },
        },
        required: ["url"],
    },
    execute: async ({ url }) => {
        if (!/^https?:\/\//i.test(url))
            return "Error: url must start with http:// or https://";
        try {
            const r = await fetch(url, { credentials: "omit" });
            const ct = r.headers.get("content-type") ?? "";
            const body = await r.text();
            if (ct.includes("text/html")) {
                const doc = new DOMParser().parseFromString(body, "text/html");
                doc.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
                const text = (doc.body?.innerText ?? "").replace(/\n{3,}/g, "\n\n");
                const clipped = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n[truncated]" : text;
                return `URL: ${url}\nTitle: ${doc.title}\n\n${clipped}`;
            }
            const clipped = body.length > MAX_CHARS ? body.slice(0, MAX_CHARS) + "\n[truncated]" : body;
            return `URL: ${url}\nContent-Type: ${ct}\n\n${clipped}`;
        }
        catch (e) {
            return `Error fetching ${url}: ${e?.message ?? e}`;
        }
    },
};
