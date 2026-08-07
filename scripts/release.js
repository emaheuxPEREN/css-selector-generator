/* eslint no-console: 0 */

// `npm version` cannot tag a package that is not at the git root: it decides
// whether to touch git by looking for a `.git` directory next to the
// package.json, which in a workspace does not exist. It then skips the commit,
// the tag and the clean-tree check while still running `postversion`, which is
// how a release can get published with nothing recorded in git. So the version
// bump is done with scripts and git disabled, and every step is explicit here.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";

const PACKAGE = "css-selector-generator";
const INCREMENTS = ["patch", "minor", "major"];
const rootDir = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(rootDir, "packages", PACKAGE, "package.json");

function run(command, args) {
  execFileSync(command, args, { cwd: rootDir, stdio: "inherit" });
}

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: "utf-8",
  }).trim();
}

function readVersion() {
  return JSON.parse(readFileSync(packageJsonPath, "utf-8")).version;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function preview(current, increment) {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!parts) {
    return "";
  }
  const [major, minor, patch] = parts.slice(1).map(Number);
  const next = {
    patch: `${String(major)}.${String(minor)}.${String(patch + 1)}`,
    minor: `${String(major)}.${String(minor + 1)}.0`,
    major: `${String(major + 1)}.0.0`,
  }[increment];
  return next ? ` ${current} -> ${next}` : "";
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } catch {
    // Ctrl+C or Ctrl+D. Treated as no answer, which every caller declines on.
    return "";
  } finally {
    rl.close();
  }
}

// A dirty tree is checked before anything else, so that a release never starts
// half-way and leaves the repository in a confusing state.
if (capture("git", ["status", "--porcelain"]) !== "") {
  fail(
    "The working tree has uncommitted changes.\n" +
      "Commit or stash them, then run `npm run release` again.",
  );
}

const currentVersion = readVersion();
let increment = process.argv[2];

if (increment && !INCREMENTS.includes(increment)) {
  fail(
    `Unknown release type "${increment}". Use one of: ${INCREMENTS.join(", ")}.`,
  );
}

if (!increment) {
  if (!process.stdin.isTTY) {
    fail(
      `Specify a release type: npm run release -- <${INCREMENTS.join("|")}>`,
    );
  }
  console.log(`\nCurrent version is ${currentVersion}.\n`);
  INCREMENTS.forEach((name, index) => {
    console.log(
      `  ${String(index + 1)}) ${name}${preview(currentVersion, name)}`,
    );
  });
  const answer = await prompt("\nWhich release? [1-3] ");
  increment =
    INCREMENTS[Number(answer) - 1] ??
    (INCREMENTS.includes(answer) ? answer : undefined);
  if (!increment) {
    fail("No release type chosen.");
  }
}

run("npm", [
  "version",
  increment,
  "--no-git-tag-version",
  "--ignore-scripts",
  "--workspace",
  PACKAGE,
]);

const version = readVersion();
if (version === currentVersion) {
  fail(`Version is still ${version}.`);
}

const tag = `v${version}`;
if (capture("git", ["tag", "--list", tag]) !== "") {
  fail(`Tag ${tag} already exists.`);
}

// Keeps the root lockfile's record of the workspace version in step, which
// `npm ci` verifies.
run("npm", ["install", "--package-lock-only"]);
run("npm", ["run", "build", "--workspace", PACKAGE]);
run("npm", ["run", "changelog", "--workspace", PACKAGE]);

run("git", ["add", "-A"]);
run("git", ["commit", "-m", version]);
run("git", ["tag", tag]);

console.log(`
${"=".repeat(60)}
Prepared ${version}. Nothing has been pushed or published yet.

Commit:  ${capture("git", ["log", "--oneline", "-1"])}
Tag:     ${tag}
Files:   ${capture("git", ["show", "--stat", "--format=", "HEAD"]).split("\n").length - 1} changed

Changelog entry:
${capture("git", [
  "show",
  "HEAD",
  "--format=",
  "-U0",
  "--",
  `packages/${PACKAGE}/CHANGELOG.md`,
])
  .split("\n")
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  .map((line) => `  ${line.slice(1)}`)
  .join("\n")}
${"=".repeat(60)}
`);

const undo = `  git tag -d ${tag} && git reset --hard HEAD~1`;

if (!process.stdin.isTTY) {
  console.log(
    `Not a terminal, so stopping here. To finish:\n\n` +
      `  git push --follow-tags\n` +
      `  npm publish --workspace ${PACKAGE} --access=public\n\n` +
      `To undo:\n\n${undo}\n`,
  );
  process.exit(0);
}

const confirmed = await prompt(
  "Does this look right? Push and publish? [y/N] ",
);

if (confirmed.toLowerCase() !== "y" && confirmed.toLowerCase() !== "yes") {
  console.log(
    `\nStopped. The commit and tag exist locally but nothing was published.\n\n` +
      `To undo:\n\n${undo}\n`,
  );
  process.exit(0);
}

run("git", ["push", "--follow-tags"]);
run("npm", ["publish", "--workspace", PACKAGE, "--access=public"]);

console.log(`\nPublished ${version}.\n`);
