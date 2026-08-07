/* eslint no-console: 0 */

// Assembles the GitHub Pages site. A repository serves only one Pages site, so
// both apps are published as subdirectories of it.

import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(rootDir, "dist");

const apps = [
  { workspace: "@fczbkk/css-selector-generator-sandbox", dir: "sandbox" },
  { workspace: "@fczbkk/css-selector-generator-benchmark", dir: "benchmark" },
];

function run(args) {
  execFileSync("npm", args, { cwd: rootDir, stdio: "inherit" });
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

// The apps resolve the library through the workspace, and its `exports` point
// at build output that is not committed.
run(["run", "build", "--workspace", "css-selector-generator"]);

for (const { workspace, dir } of apps) {
  run(["run", "build", "--workspace", workspace]);
  await cp(
    path.join(rootDir, "packages", `css-selector-generator-${dir}`, "dist"),
    path.join(outputDir, dir),
    { recursive: true },
  );
}

// Without this, GitHub Pages runs the output through Jekyll, which drops files
// and directories whose names begin with an underscore.
await writeFile(path.join(outputDir, ".nojekyll"), "");

const description = JSON.parse(
  await readFile(
    path.join(rootDir, "packages", "css-selector-generator", "package.json"),
    "utf-8",
  ),
).description;

await writeFile(
  path.join(outputDir, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CSS Selector Generator</title>
    <style>
      body {
        margin: 0 auto;
        padding: 3rem 1.5rem;
        max-width: 40rem;
        font: 16px/1.6 system-ui, sans-serif;
        color: #111;
        background: #fff;
      }
      h1 { font-size: 1.6rem; margin-bottom: 0.5rem; }
      p { color: #444; }
      ul { list-style: none; padding: 0; }
      li { margin: 1rem 0; }
      a { color: #06c; text-decoration: none; font-weight: 600; }
      a:hover { text-decoration: underline; }
      span { display: block; color: #444; font-weight: 400; }
      @media (prefers-color-scheme: dark) {
        body { color: #eee; background: #111; }
        p, span { color: #aaa; }
        a { color: #6af; }
      }
    </style>
  </head>
  <body>
    <h1>CSS Selector Generator</h1>
    <p>${description}</p>
    <ul>
      <li>
        <a href="sandbox/">Sandbox</a>
        <span>Write HTML and see the selectors the library produces.</span>
      </li>
      <li>
        <a href="benchmark/">Benchmark</a>
        <span>Compare speed and features against similar libraries.</span>
      </li>
      <li>
        <a href="https://github.com/fczbkk/css-selector-generator">Documentation</a>
        <span>Installation, options and API.</span>
      </li>
    </ul>
  </body>
</html>
`,
);

console.log(
  `Assembled the Pages site in ${path.relative(rootDir, outputDir)}.`,
);
