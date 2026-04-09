const NOISE_LINE_PATTERNS = [
  /^skip to /i,
  /^keyboard shortcuts$/i,
  /^close jump menu$/i,
  /^new feed updates/i,
  /^open emoji keyboard$/i,
  /^activate to view larger image/i,
  /^view analytics$/i,
  /^share your support/i,
  /^sort by/i,
  /^most relevant/i,
  /^for business$/i,
  /^post a job$/i,
  /^my network$/i,
  /^messaging$/i,
  /^notifications$/i,
  /^jobs$/i,
  /^home$/i,
  /^\d+\s+notifications?\b/i,
  /^0 notifications total/i,
];

const NOISE_SUBSTRINGS = [
  "skip to main content",
  "skip to search",
  "keyboard shortcuts",
  "close jump menu",
  "new feed updates",
  "open emoji keyboard",
  "activate to view larger image",
  "view analytics",
  "share your support",
  "reactivate premium",
  "privacy & terms",
  "help center",
];

const STOP_LINE_PATTERNS = [
  /^comment on /i,
  /^comments?$/i,
  /^add a comment/i,
  /^top comments?/i,
  /^see more comments?/i,
  /^view more comments?/i,
  /^load more comments?/i,
];

const ACTION_ONLY_PATTERNS = [
  /(?:^|\s)like(?:\s+\d+)?(?:\s|$)/i,
  /(?:^|\s)comment(?:\s+\d+)?(?:\s|$)/i,
  /(?:^|\s)repost(?:\s+\d+)?(?:\s|$)/i,
  /(?:^|\s)send(?:\s|$)/i,
  /(?:^|\s)reply(?:\s+\d+)?(?:\s|$)/i,
];

const SOFT_BREAK_TOKENS = [
  "0 notifications total",
  "Skip to search",
  "Skip to main content",
  "Keyboard shortcuts",
  "Close jump menu",
  "new feed updates",
  "Open Emoji Keyboard",
  "Activate to view larger image",
  "View analytics",
  "Comment on ",
  "Home My Network Jobs Messaging",
];

function compactNumber(raw) {
  const cleaned = String(raw || "")
    .replace(/,/g, "")
    .trim()
    .toLowerCase();

  if (!cleaned) return undefined;
  if (cleaned.endsWith("k")) return Math.round(parseFloat(cleaned) * 1000);
  if (cleaned.endsWith("m")) return Math.round(parseFloat(cleaned) * 1000000);

  const numeric = parseFloat(cleaned);
  return Number.isFinite(numeric) ? Math.round(numeric) : undefined;
}

function matchMetric(text, pattern) {
  const match = text.match(pattern);
  if (!match || !match[1]) return undefined;
  return compactNumber(match[1]);
}

function cleanText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function canonicalizeUrl(url) {
  try {
    const nextUrl = new URL(url);
    nextUrl.search = "";
    nextUrl.hash = "";
    return nextUrl.toString();
  } catch {
    return url;
  }
}

function collectLines(text) {
  const prepared = SOFT_BREAK_TOKENS.reduce((accumulator, token) => {
    const safe = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return accumulator.replace(new RegExp(safe, "gi"), `\n${token}`);
  }, String(text || ""))
    .replace(/\bLike\b(?:\s+\d+)?\s+\bReply\b/gi, "\nLike Reply")
    .replace(/\bReply\b(?:\s+\d+)?\s+\bComment on\b/gi, "\nReply Comment on")
    .replace(/(•\s*(?:\d+[smhdw]|mo|yr))\s+/gi, "$1\n")
    .replace(/(\b\d+[smhdw]\b)\s+(?=[A-Z])/g, "$1\n");

  return prepared
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);
}

function lineLooksLikeNoise(line) {
  const lowered = line.toLowerCase();
  return (
    NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line)) ||
    NOISE_SUBSTRINGS.some((token) => lowered.includes(token))
  );
}

function lineLooksLikeStop(line) {
  return STOP_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

function lineLooksLikeActionFooter(line) {
  const matches = ACTION_ONLY_PATTERNS.filter((pattern) => pattern.test(line)).length;
  return matches >= 2 && line.length < 100;
}

function lineLooksLikeCommentContext(line) {
  return (
    /\bcomment on\b/i.test(line) ||
    (/\blike\b/i.test(line) && /\breply\b/i.test(line) && /\bcomment\b/i.test(line))
  );
}

function lineLooksLikeAuthorMeta(line) {
  if (/(?:^|\s)•\s*(?:\d+[smhdw]|mo|yr)/i.test(line)) return true;
  if (/\bfollowers?\b/i.test(line) && /\b\d+[smhdw]\b/i.test(line) && !/[.!?]/.test(line)) {
    return true;
  }

  return (
    /\b(?:followers?|connections?|series [a-z]|intern|founder|growth|engineer|student|software|developer|product|author)\b/i.test(
      line,
    ) &&
    /[|@]/.test(line) &&
    !/[.!?]/.test(line)
  );
}

function sanitizeLines(lines, pageType) {
  const cleaned = [];
  const seen = new Set();

  for (const rawLine of lines) {
    if (lineLooksLikeNoise(rawLine)) continue;

    if (pageType === "post" && cleaned.length > 0 && lineLooksLikeCommentContext(rawLine)) {
      break;
    }

    const shouldStripActionTokens =
      lineLooksLikeActionFooter(rawLine) ||
      (/\blike\b/i.test(rawLine) && /\breply\b/i.test(rawLine) && /\bcomment\b/i.test(rawLine));
    const line = (shouldStripActionTokens
      ? rawLine.replace(/\b(?:Like|Comment|Repost|Send|Reply)\b(?:\s+\d+)?/gi, " ")
      : rawLine
    )
      .replace(/\s+/g, " ")
      .trim();

    if (!line || seen.has(line)) continue;

    if (pageType === "post" && cleaned.length > 0) {
      if (lineLooksLikeStop(line) || lineLooksLikeActionFooter(line)) {
        break;
      }
    }

    seen.add(line);
    cleaned.push(line);
  }

  if (pageType === "post") {
    while (cleaned.length > 0 && lineLooksLikeAuthorMeta(cleaned[0])) {
      cleaned.shift();
    }
  }

  return cleaned;
}

function getCleanPageText(pageType) {
  const lines = collectLines(document.body?.innerText || "");
  return sanitizeLines(lines, pageType).join("\n").slice(0, 12000);
}

function visibleElements(selectors) {
  const all = Array.from(document.querySelectorAll(selectors));
  return all.filter((element) => {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function candidateText(element) {
  return sanitizeLines(collectLines(element.innerText || ""), "post").join("\n");
}

function scoreCandidate(element, text) {
  const rect = element.getBoundingClientRect();
  let score = 0;
  const lowered = text.toLowerCase();

  if (element.tagName.toLowerCase() === "article") score += 20;
  if (element.querySelector("a[href*='/feed/update/']")) score += 12;
  if (/\bimpressions?\b/i.test(text)) score += 10;
  if (/\b(?:likes?|reactions?|comments?|reposts?)\b/i.test(text)) score += 8;
  if (text.length >= 80 && text.length <= 4000) score += 18;
  if (text.length > 5500) score -= 25;
  if (rect.top >= 0) score += Math.max(0, 35 - rect.top / 40);
  if (lowered.includes("comment on ")) score -= 40;
  if (lowered.includes("open emoji keyboard")) score -= 40;
  if (lowered.includes("skip to main content")) score -= 80;
  if (lowered.includes("0 notifications total")) score -= 80;

  return score;
}

function extractBestPostCandidate() {
  const selectors = [
    "main article",
    "[role='main'] article",
    "main [data-urn]",
    "main section",
  ].join(", ");

  const ranked = visibleElements(selectors)
    .map((element) => {
      const text = candidateText(element);
      return {
        element,
        text,
        score: text ? scoreCandidate(element, text) : -999,
      };
    })
    .filter((candidate) => candidate.text && candidate.score > -25)
    .sort((left, right) => right.score - left.score);

  return ranked[0] || null;
}

function extractProfileMetrics(text) {
  return {
    followers: matchMetric(text, /([\d.,kKmM]+)\s+followers?/i),
    profileViews: matchMetric(text, /([\d.,kKmM]+)\s+profile views?/i),
    profileAppearances: matchMetric(
      text,
      /([\d.,kKmM]+)\s+(?:profile appearances?|search appearances?)/i,
    ),
    postImpressions: matchMetric(text, /([\d.,kKmM]+)\s+post impressions?/i),
    connectionRequests: matchMetric(
      text,
      /(?:all\s*)?\(?([\d.,kKmM]+)\)?\s*(?:connection requests?|invitations?)/i,
    ),
  };
}

function extractPostMetrics(text) {
  return {
    impressions: matchMetric(text, /([\d.,kKmM]+)\s+impressions?/i),
    likes: matchMetric(text, /([\d.,kKmM]+)\s+(?:likes?|reactions?)/i),
    comments: matchMetric(text, /([\d.,kKmM]+)\s+comments?/i),
    reposts: matchMetric(text, /([\d.,kKmM]+)\s+(?:reposts?|reshares?|shares?)/i),
  };
}

function extractDiscoveredPosts() {
  const anchors = Array.from(document.querySelectorAll("main a[href*='/feed/update/']"));
  const deduped = new Map();

  for (const anchor of anchors) {
    const href = anchor.href ? canonicalizeUrl(anchor.href) : "";
    if (!href || deduped.has(href)) continue;

    const container =
      anchor.closest("article, li, section, div") || anchor.parentElement;
    const text = container ? sanitizeLines(collectLines(container.innerText || ""), "post").join("\n") : "";
    const title = text ? text.split("\n")[0].slice(0, 140) : undefined;

    deduped.set(href, {
      url: href,
      title,
    });
  }

  return Array.from(deduped.values()).slice(0, 20);
}

function extractComments() {
  const candidates = visibleElements(
    "[role='main'] [role='listitem'], main ul li, main article ul li",
  );
  const comments = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const lines = sanitizeLines(collectLines(candidate.innerText || ""), "post");
    if (lines.length < 2) continue;

    const authorName = cleanText((lines[0] || "").split("•")[0] || "");
    const note = lines.slice(1).join(" ").trim();

    if (
      !authorName ||
      !note ||
      note.length < 20 ||
      note.length > 400 ||
      seen.has(`${authorName}::${note}`) ||
      lineLooksLikeNoise(note)
    ) {
      continue;
    }

    seen.add(`${authorName}::${note}`);
    comments.push({ authorName, note });
    if (comments.length >= 5) break;
  }

  return comments;
}

function extractPostImages(rootElement) {
  if (!rootElement) return [];

  const images = Array.from(rootElement.querySelectorAll("img"));
  const deduped = new Map();

  for (const image of images) {
    const src = image.currentSrc || image.src;
    const url = src ? canonicalizeUrl(src) : "";
    const width = image.naturalWidth || image.width || 0;
    const height = image.naturalHeight || image.height || 0;
    const alt = cleanText(image.alt || "");
    const loweredUrl = url.toLowerCase();
    const loweredAlt = alt.toLowerCase();

    if (!url || deduped.has(url)) continue;
    if (!/^https?:/i.test(url)) continue;
    if (width < 140 || height < 140) continue;
    if (
      loweredUrl.includes("profile-displayphoto") ||
      loweredUrl.includes("company-logo") ||
      loweredUrl.includes("ghost_person") ||
      loweredAlt.includes("profile picture") ||
      loweredAlt.includes("logo")
    ) {
      continue;
    }

    deduped.set(url, {
      url,
      alt,
      width,
      height,
    });
  }

  return Array.from(deduped.values()).slice(0, 4);
}

function extractPayload(target) {
  const pageUrl = canonicalizeUrl(window.location.href);

  if (target === "profile") {
    const extractedText = getCleanPageText("profile");
    return {
      pageType: "profile",
      pageUrl,
      extractedText,
      confidence: 0.86,
      captureMethod: "browser",
      profileMetrics: extractProfileMetrics(extractedText),
      discoveredPosts: [],
    };
  }

  if (target === "activity") {
    const extractedText = getCleanPageText("activity");
    return {
      pageType: "activity",
      pageUrl,
      extractedText,
      confidence: 0.82,
      captureMethod: "browser",
      discoveredPosts: extractDiscoveredPosts(),
    };
  }

  const bestCandidate = extractBestPostCandidate();
  const candidateTextValue = bestCandidate?.text || "";
  const extractedText = candidateTextValue || getCleanPageText("post");
  const title = extractedText.split("\n")[0]?.slice(0, 140) || pageUrl;

  return {
    pageType: "post",
    pageUrl,
    extractedText,
    confidence: bestCandidate ? 0.9 : 0.6,
    captureMethod: "browser",
    post: {
      canonicalUrl: pageUrl,
      title,
      finalText: extractedText,
      images: extractPostImages(bestCandidate?.element || document.body),
      metrics: extractPostMetrics(extractedText),
      comments: extractComments(),
    },
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EDWARD_ENGINE_EXTRACT") {
    return false;
  }

  try {
    const payload = extractPayload(message.target || "post");
    sendResponse({ ok: true, payload });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "extract failed",
    });
  }

  return true;
});
