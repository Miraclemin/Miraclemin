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

function buildSvg(stats) {
  const rows = [
    ["Public Repos", stats.publicRepos],
    ["Followers", stats.followers],
    ["Total Stars", stats.totalStars],
    ["Pull Requests", stats.pullRequests],
    ["Issues", stats.issues],
    ["Following", stats.following],
  ];

  const rowSvg = rows
    .map(([label, value], index) => {
      const y = 116 + index * 48;
      return `
    <g transform="translate(36 ${y})">
      <circle cx="6" cy="-5" r="6" fill="#2f81f7" opacity="0.85" />
      <text x="24" y="0" class="label">${escapeXml(label)}</text>
      <text x="408" y="0" class="value" text-anchor="end">${escapeXml(formatNumber(value))}</text>
    </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="460" height="420" viewBox="0 0 460 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} GitHub Stats</title>
  <desc id="desc">Daily generated GitHub profile statistics card for ${escapeXml(username)}.</desc>
  <defs>
    <linearGradient id="bg" x1="24" y1="24" x2="436" y2="396" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0D1117" />
      <stop offset="1" stop-color="#161B22" />
    </linearGradient>
    <linearGradient id="accent" x1="36" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#58A6FF" />
      <stop offset="1" stop-color="#79C0FF" />
    </linearGradient>
  </defs>
  <style>
    .title { font: 700 28px 'Segoe UI', Ubuntu, Sans-Serif; fill: #f0f6fc; }
    .subtitle { font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: #8b949e; }
    .label { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; fill: #c9d1d9; }
    .value { font: 700 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: #f0f6fc; }
    .footer { font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; fill: #8b949e; }
  </style>
  <rect x="12" y="12" width="436" height="396" rx="20" fill="url(#bg)" stroke="#30363d" />
  <text x="36" y="58" class="title">${escapeXml(username)} GitHub Stats</text>
  <text x="36" y="84" class="subtitle">Generated daily with GitHub Actions</text>
  <rect x="36" y="96" width="180" height="4" rx="2" fill="url(#accent)" />
  ${rowSvg}
  <text x="36" y="388" class="footer">Source: GitHub API</text>
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

const svg = buildSvg({
  publicRepos,
  followers,
  totalStars,
  pullRequests,
  issues,
  following,
});

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, svg, "utf8");
