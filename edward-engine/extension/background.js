const STORAGE_KEY = "edward-engine-local-reader";
const TOKEN_HEADER = "x-edward-local-reader-token";

function getStoredState() {
  return chrome.storage.local.get(STORAGE_KEY).then((payload) => {
    return payload[STORAGE_KEY] || {};
  });
}

function setStoredState(value) {
  return chrome.storage.local.set({ [STORAGE_KEY]: value });
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `request failed for ${url}`);
  }
  return payload;
}

async function waitForTabComplete(tabId) {
  const existing = await chrome.tabs.get(tabId);
  if (existing.status === "complete") {
    return existing;
  }

  return new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(chrome.tabs.get(tabId));
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function openTab(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  if (!tab.id) {
    throw new Error("failed to create tab");
  }
  await waitForTabComplete(tab.id);
  await new Promise((resolve) => setTimeout(resolve, 500));
  return tab.id;
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch {}
}

async function extractFromTab(tabId, target) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "EDWARD_ENGINE_EXTRACT",
        target,
      });
      if (response?.ok) {
        return response.payload;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error(`unable to extract ${target} payload from LinkedIn tab`);
}

async function pairWithApp(appOrigin) {
  const payload = await fetchJson(`${trimSlash(appOrigin)}/api/local-reader/pair`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appOrigin: trimSlash(appOrigin),
      extensionVersion: chrome.runtime.getManifest().version,
    }),
  });

  await setStoredState({
    appOrigin: trimSlash(appOrigin),
    pairToken: payload.pairToken,
  });

  return payload;
}

async function ingestPayload(appOrigin, pairToken, payload) {
  return fetchJson(`${trimSlash(appOrigin)}/api/local-reader/linkedin/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [TOKEN_HEADER]: pairToken,
    },
    body: JSON.stringify(payload),
  });
}

async function finishRun(appOrigin, pairToken, body) {
  return fetchJson(`${trimSlash(appOrigin)}/api/local-reader/linkedin/finish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [TOKEN_HEADER]: pairToken,
    },
    body: JSON.stringify(body),
  });
}

async function syncLinkedIn(appOrigin) {
  const stored = await getStoredState();
  const origin = trimSlash(appOrigin || stored.appOrigin);
  const pairToken = stored.pairToken;

  if (!origin || !pairToken) {
    throw new Error("pair the extension with Edward Engine first");
  }

  const startPayload = await fetchJson(
    `${origin}/api/local-reader/linkedin/start`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TOKEN_HEADER]: pairToken,
      },
    },
  );

  let pagesVisited = 0;
  let publicationsTouched = 0;
  let commentsCaptured = 0;
  const discoveredPostUrls = new Set(startPayload.knownPostUrls || []);

  try {
    if (startPayload.profileUrlHint) {
      const profileTabId = await openTab(startPayload.profileUrlHint);
      try {
        const profilePayload = await extractFromTab(profileTabId, "profile");
        await ingestPayload(origin, pairToken, {
          ...profilePayload,
          runId: startPayload.runId,
        });
        pagesVisited += 1;
      } finally {
        await closeTab(profileTabId);
      }
    }

    if (startPayload.activityUrl) {
      const activityTabId = await openTab(startPayload.activityUrl);
      try {
        const activityPayload = await extractFromTab(activityTabId, "activity");
        await ingestPayload(origin, pairToken, {
          ...activityPayload,
          runId: startPayload.runId,
        });
        for (const discovered of activityPayload.discoveredPosts || []) {
          if (discovered.url) {
            discoveredPostUrls.add(discovered.url);
          }
        }
        pagesVisited += 1;
      } finally {
        await closeTab(activityTabId);
      }
    }

    for (const postUrl of Array.from(discoveredPostUrls).slice(0, 20)) {
      const postTabId = await openTab(postUrl);
      try {
        const postPayload = await extractFromTab(postTabId, "post");
        await ingestPayload(origin, pairToken, {
          ...postPayload,
          runId: startPayload.runId,
        });
        pagesVisited += 1;
        publicationsTouched += 1;
        commentsCaptured += (postPayload.post?.comments || []).length;
      } finally {
        await closeTab(postTabId);
      }
    }

    await finishRun(origin, pairToken, {
      runId: startPayload.runId,
      status: "succeeded",
      pagesVisited,
      publicationsTouched,
      commentsCaptured,
    });

    return { ok: true };
  } catch (error) {
    await finishRun(origin, pairToken, {
      runId: startPayload.runId,
      status: "failed",
      error: error instanceof Error ? error.message : "sync failed",
      pagesVisited,
      publicationsTouched,
      commentsCaptured,
    }).catch(() => undefined);

    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) {
    sendResponse({ ok: false, error: "missing message type" });
    return false;
  }

  (async () => {
    if (message.type === "EDWARD_ENGINE_PING") {
      const stored = await getStoredState();
      sendResponse({ ok: true, payload: { paired: Boolean(stored.pairToken) } });
      return;
    }

    if (message.type === "EDWARD_ENGINE_PAIR") {
      await pairWithApp(message.appOrigin);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "EDWARD_ENGINE_SYNC") {
      await syncLinkedIn(message.appOrigin);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "unknown message type" });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "extension request failed",
    });
  });

  return true;
});
