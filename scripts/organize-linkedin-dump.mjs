#!/usr/bin/env node

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ?? "posts/bunch of posts.md";
const outputDir = args.output ?? "posts/dump-organized";
const referenceDate = new Date(args.referenceDate ?? "2026-05-04T00:00:00+07:00");

if (args.clean) {
  rmSync(outputDir, { recursive: true, force: true });
}

const dump = readFileSync(inputPath, "utf8");
const posts = parseDump(dump, referenceDate);

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "index.json"), `${JSON.stringify(posts.map(toIndexRow), null, 2)}\n`);
writeFileSync(join(outputDir, "index.md"), renderIndex(posts));

for (const post of posts) {
  const folder = join(outputDir, `${pad(post.rawIndex)}-${post.approxDate}-ish-${post.slug}`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "post.md"), `${post.body.trim()}\n`);
  writeFileSync(join(folder, "metadata.json"), `${JSON.stringify(toIndexRow(post), null, 2)}\n`);
}

console.log(`organized ${posts.length} posts into ${outputDir}`);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--clean") {
      parsed.clean = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      parsed[key] = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}

function parseDump(text, refDate) {
  const starts = [...text.matchAll(/(?=Feed post number \d+\n)/g)].map((match) => match.index);
  const spans = starts.length
    ? [[0, starts[0]], ...starts.map((start, index) => [start, starts[index + 1] ?? text.length])]
    : [[0, text.length]];

  const posts = [];
  for (const [start, end] of spans) {
    const chunk = text.slice(start, end);
    if (!chunk.includes("Edward TranEdward Tran")) continue;

    const rawIndex = posts.length + 1;
    const lines = chunk.split(/\r?\n/).map((line) => line.trim());
    const visibilityIndex = lines.findIndex((line) => line.includes("Visible to anyone"));
    const bodyLines = extractBody(lines, visibilityIndex);
    const body = bodyLines.join("\n").trim();
    if (!body) continue;

    const hook = bodyLines.find((line) => line.trim()) ?? "";
    const relativeAge = extractRelativeAge(lines[visibilityIndex] ?? "");
    const approxDate = approximateDate(relativeAge, refDate);
    const metrics = extractMetrics(lines);
    const tags = inferTags(body);

    posts.push({
      rawIndex,
      relativeAge,
      approxDate,
      hook,
      slug: slugify(hook || `post-${rawIndex}`),
      wordCount: countWords(body),
      body,
      metrics,
      tags,
      likelyRepost: body.includes("Follow\n") || body.includes("View ") && body.includes("’s  graphic link"),
    });
  }

  return posts;
}

function extractBody(lines, visibilityIndex) {
  if (visibilityIndex < 0) return [];

  const stopPatterns = [
    /^…more$/,
    /^Like$/,
    /^Comment$/,
    /^Repost$/,
    /^Send$/,
    /^View analytics$/,
    /^Boost$/,
    /^Activate to /,
    /^Photo of /,
    /^Promote this post/,
    /^This post is /,
    /^Play$/,
    /^Remaining time/,
    /^Playback speed$/,
    /^Unmute$/,
    /^Turn fullscreen on$/,
  ];

  const body = [];
  for (const line of lines.slice(visibilityIndex + 1)) {
    if (stopPatterns.some((pattern) => pattern.test(line))) break;
    if (/^View .* graphic link$/.test(line)) break;
    body.push(line);
  }

  return trimBlankEdges(body);
}

function extractRelativeAge(line) {
  const match = line.match(/(\d+\s*(?:h|d|w|mo|yr))\s*•/);
  return match ? match[1].replace(/\s+/g, "") : null;
}

function approximateDate(relativeAge, refDate) {
  const date = new Date(refDate);
  const match = relativeAge?.match(/^(\d+)(h|d|w|mo|yr)$/);
  if (!match) return "unknown-date";

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "h") date.setDate(date.getDate() - (amount >= 24 ? Math.floor(amount / 24) : 0));
  if (unit === "d") date.setDate(date.getDate() - amount);
  if (unit === "w") date.setDate(date.getDate() - amount * 7);
  if (unit === "mo") date.setDate(date.getDate() - amount * 30);
  if (unit === "yr") date.setDate(date.getDate() - amount * 365);

  return date.toISOString().slice(0, 10);
}

function extractMetrics(lines) {
  const joined = lines.join("\n");
  const impressions = lastNumberMatch(joined, /([0-9,]+) impressions/g);
  const comments = lastNumberMatch(joined, /(\d+) comments/g) ?? 0;
  const reposts = lastNumberMatch(joined, /(\d+) reposts/g) ?? 0;
  let reactions = null;

  for (let index = 0; index < lines.length; index += 1) {
    const compact = lines[index].replace(/\s+/g, "");
    if (!compact.startsWith("like")) continue;
    if (compact.length > 44) continue;

    for (let offset = 1; offset <= 4; offset += 1) {
      const candidate = lines[index + offset];
      if (/^[0-9,]+$/.test(candidate ?? "")) {
        reactions = Number(candidate.replace(/,/g, ""));
        break;
      }
    }
    if (reactions !== null) break;
  }

  return { impressions, reactions, comments, reposts };
}

function lastNumberMatch(text, pattern) {
  let value = null;
  for (const match of text.matchAll(pattern)) {
    value = Number(match[1].replace(/,/g, ""));
  }
  return value;
}

function inferTags(body) {
  const lower = body.toLowerCase();
  const tagMap = {
    proof_of_work: ["built", "build", "shipped", "ship", "repo", "project", "code", "demo"],
    ai_agents: ["agent", "agents", "codex", "claude", "gpt", "ai", "llm", "prompt", "context layer", "tokens"],
    status_social: ["yc", "mit", "elon", "jensen", "openai", "elevenlabs", "tinyfish", "series a"],
    human_story: ["kid", "sick", "dengue", "dead", "rest", "procrastinator", "nobody wanted", "first day"],
    event_community: ["ai tinkerers", "event", "presented", "hackathon", "saigon", "meetup"],
    hiring_career: ["hire", "hiring", "interview", "portfolio", "recruiter", "intern"],
    faith: ["jesus", "catholic", "saint", "christus", "joseph", "god"],
    hot_take: ["sucks", "mid", "cooked", "sleeping on", "nobody talking", "boring", "banned"],
  };

  return Object.entries(tagMap)
    .filter(([, terms]) => terms.some((term) => lower.includes(term)))
    .map(([tag]) => tag);
}

function toIndexRow(post) {
  return {
    rawIndex: post.rawIndex,
    relativeAge: post.relativeAge,
    approxDate: post.approxDate,
    hook: post.hook,
    slug: post.slug,
    wordCount: post.wordCount,
    metrics: post.metrics,
    tags: post.tags,
  };
}

function renderIndex(posts) {
  const lines = [
    "# LinkedIn Dump Organized Index",
    "",
    "Generated from `posts/bunch of posts.md`.",
    "",
    "| # | Approx date | Hook | Impressions | Reactions | Comments | Tags |",
    "|---:|---|---|---:|---:|---:|---|",
  ];

  for (const post of posts) {
    const metrics = post.metrics;
    lines.push(
      `| ${post.rawIndex} | ${post.approxDate} | ${escapePipe(post.hook)} | ${metrics.impressions ?? ""} | ${metrics.reactions ?? ""} | ${metrics.comments ?? 0} | ${post.tags.join(", ")} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function trimBlankEdges(lines) {
  const copy = [...lines];
  while (copy[0] === "") copy.shift();
  while (copy[copy.length - 1] === "") copy.pop();
  return copy;
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "untitled";
}

function escapePipe(text) {
  return text.replace(/\|/g, "\\|");
}

function pad(number) {
  return String(number).padStart(3, "0");
}
