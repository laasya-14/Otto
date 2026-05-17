import { Readability } from "@mozilla/readability";
const MAX_CHARS = 50000;
function extractPage() {
    const url = location.href;
    const title = document.title;
    let pageText = "";
    let truncated = false;
    try {
        const clone = document.cloneNode(true);
        const article = new Readability(clone).parse();
        if (article && article.textContent && article.textContent.length >= 200) {
            pageText = article.textContent;
        }
    }
    catch { }
    if (!pageText) {
        pageText = document.body?.innerText ?? "";
    }
    if (pageText.length > MAX_CHARS) {
        pageText = pageText.slice(0, MAX_CHARS);
        truncated = true;
    }
    return { url, title, pageText, truncated };
}
function extractSelection() {
    const selection = window.getSelection()?.toString() ?? "";
    return { url: location.href, title: document.title, selection };
}
console.log("[Side] content script loaded on", location.href);
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "GET_PAGE") {
        sendResponse(extractPage());
        return false;
    }
    if (msg?.type === "GET_SELECTION") {
        sendResponse(extractSelection());
        return false;
    }
    return false;
});
