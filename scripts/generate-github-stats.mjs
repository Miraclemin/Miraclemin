import fs from "node:fs/promises";
import path from "node:path";

const token = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USERNAME;
const outputPath = process.env.OUTPUT_PATH || "assets/github-stats.svg";

if (!token) {
  throw new Error("GITHUB_TOKEN is required");
}

if (!username) {
  throw new Error("GITHUB_USERNAME is required");
}

const jsonHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "User-Agent": "github-profile-stats-generator",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: jsonHeaders });
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function fetchAllRepos() {
  const repos = [];
  let page = 1;

  while (true) {
    const url = new URL(`https://api.github.com/users/${username}/repos`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("type", "owner");
    url.searchParams.set("sort", "updated");

    const batch = await fetchJson(url);
    repos.push(...batch);

    if (batch.length < 100) {
      break;
    }

    page += 1;
  }

  return repos;
}

async function fetchSearchCount(query) {
  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", "1");
  const result = await fetchJson(url);
  return result.total_count ?? 0;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function buildSvg(stats) {
  const cards = [
    { label: "Public Repos", value: stats.publicRepos, color: "#58A6FF" },
    { label: "Followers", value: stats.followers, color: "#7EE787" },
    { label: "Total Stars", value: stats.totalStars, color: "#F2CC60" },
    { label: "Pull Requests", value: stats.pullRequests, color: "#FF7B72" },
    { label: "Issues", value: stats.issues, color: "#D2A8FF" },
    { label: "Following", value: stats.following, color: "#FFA657" },
  ];

  const cardSvg = cards
    .map((card, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 28 + column * 220;
      const y = 102 + row * 90;

      return `
    <g transform="translate(${x} ${y})">
      <rect width="192" height="72" rx="18" fill="rgba(255,255,255,0.03)" stroke="rgba(240,246,252,0.07)" />
      <rect x="16" y="16" width="8" height="40" rx="4" fill="${card.color}" />
      <text x="40" y="31" class="card-label">${escapeXml(card.label)}</text>
      <text x="40" y="56" class="card-value">${escapeXml(formatNumber(card.value))}</text>
    </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="468" height="392" viewBox="0 0 468 392" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} GitHub Stats</title>
  <desc id="desc">Daily generated GitHub profile statistics card for ${escapeXml(username)}.</desc>
  <defs>
    <linearGradient id="bg" x1="18" y1="18" x2="450" y2="374" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0D1117" />
      <stop offset="0.55" stop-color="#101722" />
      <stop offset="1" stop-color="#161B22" />
    </linearGradient>
    <linearGradient id="accent" x1="28" y1="0" x2="235" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#58A6FF" />
      <stop offset="0.5" stop-color="#79C0FF" />
      <stop offset="1" stop-color="#A5D6FF" />
    </linearGradient>
    <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(70 36) rotate(46.3) scale(163.986 108.119)">
      <stop stop-color="#1F6FEB" stop-opacity="0.28" />
      <stop offset="1" stop-color="#1F6FEB" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(392 58) rotate(131.82) scale(151.682 85.1147)">
      <stop stop-color="#A371F7" stop-opacity="0.20" />
      <stop offset="1" stop-color="#A371F7" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="1.25" cy="1.25" r="1.25" fill="rgba(240,246,252,0.06)" />
    </pattern>
  </defs>
  <style>
    .eyebrow { font: 700 11px 'Segoe UI', Ubuntu, Sans-Serif; fill: #7d8590; letter-spacing: 0.2em; text-transform: uppercase; }
    .title { font: 700 29px 'Segoe UI', Ubuntu, Sans-Serif; fill: #f0f6fc; }
    .subtitle { font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: #8b949e; }
    .pill { font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif; fill: #dbeafe; }
    .card-label { font: 600 13px 'Segoe UI', Ubuntu, Sans-Serif; fill: #8b949e; }
    .card-value { font: 700 26px 'Segoe UI', Ubuntu, Sans-Serif; fill: #f0f6fc; }
    .footer { font: 500 11px 'Segoe UI', Ubuntu, Sans-Serif; fill: #7d8590; letter-spacing: 0.03em; }
  </style>
  <rect x="10" y="10" width="448" height="372" rx="24" fill="url(#bg)" stroke="#30363d" />
  <rect x="10" y="10" width="448" height="372" rx="24" fill="url(#grid)" opacity="0.16" />
  <ellipse cx="110" cy="42" rx="168" ry="96" fill="url(#glowA)" />
  <ellipse cx="372" cy="62" rx="144" ry="82" fill="url(#glowB)" />

  <text x="28" y="40" class="eyebrow">GitHub Profile</text>
  <text x="28" y="72" class="title">${escapeXml(username)} Stats</text>
  <text x="28" y="94" class="subtitle">Stable daily card generated from GitHub API data</text>
  <rect x="28" y="108" width="206" height="4" rx="2" fill="url(#accent)" opacity="0.95" />

  <g transform="translate(338 28)">
    <rect width="96" height="32" rx="16" fill="rgba(88,166,255,0.12)" stroke="rgba(88,166,255,0.28)" />
    <text x="48" y="20" class="pill" text-anchor="middle">Updated Daily</text>
  </g>

  <g transform="translate(296 68)">
    <rect width="138" height="32" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(240,246,252,0.06)" />
    <text x="69" y="20" class="pill" text-anchor="middle">Since ${escapeXml(formatDate(stats.accountCreatedAt))}</text>
  </g>

  ${cardSvg}

  <text x="28" y="356" class="footer">Source: GitHub API</text>
  <text x="438" y="356" class="footer" text-anchor="end">via GitHub Actions</text>
</svg>`;
}

const [user, repos, pullRequests, issues] = await Promise.all([
  fetchJson(`https://api.github.com/users/${username}`),
  fetchAllRepos(),
  fetchSearchCount(`author:${username} is:pr`),
  fetchSearchCount(`author:${username} is:issue`),
]);

const totalStars = repos.reduce((sum, repo) => sum + (repo.stargazers_count ?? 0), 0);
const publicRepos = user.public_repos ?? repos.length;
const followers = user.followers ?? 0;
const following = user.following ?? 0;
const accountCreatedAt = user.created_at ?? new Date().toISOString();

const svg = buildSvg({
  publicRepos,
  followers,
  totalStars,
  pullRequests,
  issues,
  following,
  accountCreatedAt,
});

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, svg, "utf8");
