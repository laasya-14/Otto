import type { PageExtract, PendingContext } from "../../shared/types";

export async function fetchPendingContext(): Promise<PendingContext | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "FETCH_PENDING_CONTEXT" }, (r) =>
      resolve(r ?? null)
    );
  });
}

export async function bgGetSelection(): Promise<PageExtract | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "BG_GET_SELECTION" }, (r) =>
      resolve(r ?? null)
    );
  });
}

export async function bgGetPage(): Promise<PageExtract | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "BG_GET_PAGE" }, (r) =>
      resolve(r ?? null)
    );
  });
}

export async function fetchFocusComposer(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "FETCH_FOCUS_COMPOSER" }, (r) =>
      resolve(r ?? null)
    );
  });
}

export function onPendingContext(cb: (ctx: PendingContext) => void) {
  const listener = (msg: any) => {
    if (msg?.type === "PENDING_CONTEXT" && msg.ctx) cb(msg.ctx);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

export function onFocusComposer(cb: () => void) {
  const listener = (msg: any) => {
    if (msg?.type === "FOCUS_COMPOSER") cb();
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

export async function getActiveTab(): Promise<{ url: string; title: string } | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.url) return null;
    return { url: tab.url, title: tab.title ?? tab.url };
  } catch {
    return null;
  }
}
