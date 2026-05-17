const KEY = "side.settings";
export async function loadSettings() {
    const r = await chrome.storage.local.get(KEY);
    return r[KEY] ?? {};
}
export async function saveSettings(s) {
    const cur = await loadSettings();
    await chrome.storage.local.set({ [KEY]: { ...cur, ...s } });
}
