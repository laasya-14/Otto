export async function fetchPendingContext() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "FETCH_PENDING_CONTEXT" }, (r) => resolve(r ?? null));
    });
}
export async function bgGetSelection() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "BG_GET_SELECTION" }, (r) => resolve(r ?? null));
    });
}
export async function bgGetPage() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "BG_GET_PAGE" }, (r) => resolve(r ?? null));
    });
}
export async function fetchFocusComposer() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "FETCH_FOCUS_COMPOSER" }, (r) => resolve(r ?? null));
    });
}
export function onPendingContext(cb) {
    const listener = (msg) => {
        if (msg?.type === "PENDING_CONTEXT" && msg.ctx)
            cb(msg.ctx);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
}
export function onFocusComposer(cb) {
    const listener = (msg) => {
        if (msg?.type === "FOCUS_COMPOSER")
            cb();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
}
