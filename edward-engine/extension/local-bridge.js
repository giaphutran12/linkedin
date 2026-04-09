const PAGE_SOURCE = "edward-engine-ui";
const EXTENSION_SOURCE = "edward-engine-extension";

function mapMessageType(type) {
  switch (type) {
    case "EDWARD_ENGINE_PING":
      return "EDWARD_ENGINE_PONG";
    case "EDWARD_ENGINE_PAIR":
      return "EDWARD_ENGINE_PAIR_RESULT";
    case "EDWARD_ENGINE_SYNC":
      return "EDWARD_ENGINE_SYNC_RESULT";
    default:
      return "EDWARD_ENGINE_UNKNOWN";
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== PAGE_SOURCE) return;

  chrome.runtime.sendMessage(
    {
      type: event.data.type,
      appOrigin: event.data.appOrigin,
    },
    (response) => {
      const payload = chrome.runtime.lastError
        ? { ok: false, error: chrome.runtime.lastError.message }
        : response ?? { ok: false, error: "no extension response" };

      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: mapMessageType(event.data.type),
          ...payload,
        },
        window.location.origin,
      );
    },
  );
});
