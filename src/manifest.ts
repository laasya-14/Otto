import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Otto",
  version: "0.1.0",
  description: "Your browsing sidekick — a multi-model chat assistant that knows the page you're on.",
  icons: {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png",
  },
  action: {
    default_title: "Open Otto",
    default_icon: {
      "16": "public/icons/icon-16.png",
      "32": "public/icons/icon-32.png",
    },
  },
  permissions: ["sidePanel", "storage", "activeTab", "scripting", "tabs", "clipboardRead", "clipboardWrite"],
  host_permissions: [
    "https://api.anthropic.com/*",
    "https://api.openai.com/*",
    "<all_urls>",
  ],
  side_panel: { default_path: "src/sidepanel/index.html" },
  background: { service_worker: "src/background/index.ts", type: "module" },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  commands: {
    "open-with-selection": {
      suggested_key: { default: "Ctrl+Shift+L", mac: "Command+Shift+L" },
      description: "Open Side; attach selection if any",
    },
    "attach-page": {
      suggested_key: { default: "Ctrl+Shift+U", mac: "Command+Shift+U" },
      description: "Attach current page as context",
    },
  },
});
