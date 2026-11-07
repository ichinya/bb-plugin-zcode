import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function releaseTag(manifest, lock) {
  const version = manifest.version;
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("A stable x.y.z package version is required");
  }
  if (lock.version !== version || lock.packages?.[""]?.version !== version) {
    throw new Error("package.json and package-lock.json versions differ");
  }
  return `v${version}`;
}

// request returns { status, data }; injection keeps policy tests offline.
export async function createVersionTag({ manifest, lock, repository, sha, request }) {
  const tag = releaseTag(manifest, lock);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error("Invalid GitHub repository or commit");
  }
  const root = `/repos/${repository}/git`;
  const main = await request("GET", `${root}/ref/heads/main`);
  if (main.status !== 200) throw new Error(`Cannot verify main: HTTP ${main.status}`);
  if (main.data.object.sha !== sha) return { tag, status: "skipped-stale-main" };
  const tagPath = `${root}/ref/tags/${tag}`;
  const existing = await request("GET", tagPath);
  if (existing.status === 200) return { tag, status: "already-exists" };
  if (existing.status !== 404) throw new Error(`Cannot check tag: HTTP ${existing.status}`);
  const created = await request("POST", `${root}/refs`, { ref: `refs/tags/${tag}`, sha });
  if (created.status === 201) return { tag, status: "created" };
  // A concurrent run may have created the immutable tag first.
  if (created.status === 422 && (await request("GET", tagPath)).status === 200) {
    return { tag, status: "already-exists" };
  }
  throw new Error(`Cannot create tag: HTTP ${created.status}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.env.GITHUB_REF !== "refs/heads/main" || !["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME)) {
    throw new Error("Tags may be created only by a main push or manual main CI run");
  }
  if (!process.env.GH_TOKEN) throw new Error("GH_TOKEN is required");
  const request = async (method, endpoint, body) => {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    return { status: response.status, data: await response.json() };
  };
  const result = await createVersionTag({
    manifest: JSON.parse(readFileSync("package.json", "utf8")),
    lock: JSON.parse(readFileSync("package-lock.json", "utf8")),
    repository: process.env.GITHUB_REPOSITORY,
    sha: process.env.GITHUB_SHA,
    request,
  });
  console.log(`${result.tag}: ${result.status}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${result.tag}: ${result.status}\n`);
}
