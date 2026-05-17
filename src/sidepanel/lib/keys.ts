export interface Settings {
  anthropicKey?: string;
  openaiKey?: string;
  geminiKey?: string;
  defaultModelId?: string;
  truncationCap?: number;
  allowedFetchDomains?: string[];
  customInstructions?: string;
}

const KEY = "side.settings";

export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(KEY);
  return (r[KEY] as Settings) ?? {};
}

export async function saveSettings(s: Settings): Promise<void> {
  const cur = await loadSettings();
  await chrome.storage.local.set({ [KEY]: { ...cur, ...s } });
}
