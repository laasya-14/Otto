import type { PageExtract, PendingContext } from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

const MAX_CHARS = 50000;

// In-tab fallbacks that don't need the content script.
function pageGetSelection(): { url: string; title: string; selection: string } {
  return {
    url: location.href,
    title: document.title,
    selection: window.getSelection()?.toString() ?? "",
  };
}

function pageGetText(maxChars: number): {
  url: string;
  title: string;
  pageText: string;
  truncated: boolean;
} {
  let pageText = (document.body as HTMLElement | null)?.innerText ?? "";
  let truncated = false;
  if (pageText.length > maxChars) {
    pageText = pageText.slice(0, maxChars);
    truncated = true;
  }
  return { url: location.href, title: document.title, pageText, truncated };
}

async function askContent(
  tabId: number,
  msg: { type: "GET_SELECTION" | "GET_PAGE" }
): Promise<PageExtract | null> {
  // Try the content script first (gives us Readability for GET_PAGE).
  try {
    const r = await chrome.tabs.sendMessage(tabId, msg);
    if (r) return r as PageExtract;
  } catch (e) {
    console.warn("[Side] content script not reachable, falling back to executeScript:", e);
  }
  // Fallback: inject a self-contained function.
  try {
    if (msg.type === "GET_SELECTION") {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId },
        func: pageGetSelection,
      });
      return (r?.result as PageExtract) ?? null;
    } else {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId },
        func: pageGetText,
        args: [MAX_CHARS],
      });
      return (r?.result as PageExtract) ?? null;
    }
  } catch (e) {
    console.warn("[Side] executeScript also failed:", e);
    return null;
  }
}

async function setPending(ctx: PendingContext) {
  await chrome.storage.session.set({ pendingContext: ctx });
  chrome.runtime.sendMessage({ type: "PENDING_CONTEXT", ctx }).catch(() => {});
}

async function requestComposerFocus() {
  const at = Date.now();
  await chrome.storage.session.set({ focusComposerAt: at });
  chrome.runtime.sendMessage({ type: "FOCUS_COMPOSER", at }).catch(() => {});
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  console.log("[Side] command:", command, "tab:", tab?.id, tab?.url);

  // Open the panel synchronously in the user-gesture frame, using the tab arg.
  const tabId = tab?.id;
  if (tabId != null) {
    chrome.sidePanel.open({ tabId }).catch((e) =>
      console.warn("[Side] sidePanel.open failed:", e)
    );
    void requestComposerFocus();
  } else {
    console.warn("[Side] no tab on command event");
  }

  if (tabId == null) return;

  if (command === "open-with-selection") {
    const sel = await askContent(tabId, { type: "GET_SELECTION" });
    const page = await askContent(tabId, { type: "GET_PAGE" });
    console.log("[Side] selection result:", sel);
    console.log("[Side] page result length:", page?.pageText?.length);

    const items: PendingContext["items"] = [];
    if (sel && sel.selection && sel.selection.trim().length > 0) {
      items.push({ kind: "selection", payload: sel });
    }
    if (page && page.pageText && page.pageText.trim().length > 0) {
      items.push({ kind: "page", payload: page });
    }

    if (items.length > 0) {
      await setPending({ items, at: Date.now() });
    } else {
      // No selection or unreachable tab — panel still opens, no chip added.
      console.log("[Side] no selection/page content or content script unreachable");
    }
  } else if (command === "attach-page") {
    const page = await askContent(tabId, { type: "GET_PAGE" });
    console.log("[Side] page result length:", page?.pageText?.length);
    if (page && page.pageText) {
      await setPending({ items: [{ kind: "page", payload: page }], at: Date.now() });
    } else {
      console.log("[Side] no page content (tab may need reload to inject content script)");
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "FETCH_PENDING_CONTEXT") {
    chrome.storage.session.get("pendingContext").then(async (r) => {
      const ctx = r.pendingContext as PendingContext | undefined;
      if (ctx) await chrome.storage.session.remove("pendingContext");
      sendResponse(ctx ?? null);
    });
    return true;
  }
  if (msg?.type === "FETCH_FOCUS_COMPOSER") {
    chrome.storage.session.get("focusComposerAt").then(async (r) => {
      const at = r.focusComposerAt as number | undefined;
      if (at) await chrome.storage.session.remove("focusComposerAt");
      sendResponse(at ?? null);
    });
    return true;
  }
  if (msg?.type === "BG_GET_SELECTION" || msg?.type === "BG_GET_PAGE") {
    activeTabId().then(async (tabId) => {
      if (!tabId) return sendResponse(null);
      const r = await askContent(
        tabId,
        msg.type === "BG_GET_SELECTION"
          ? { type: "GET_SELECTION" }
          : { type: "GET_PAGE" }
      );
      sendResponse(r);
    });
    return true;
  }
  return false;
});
