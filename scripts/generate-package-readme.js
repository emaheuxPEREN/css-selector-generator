/* eslint no-console: 0 */

// The library's README is what npm shows, and the repository root README is
// what GitHub shows. Both audiences want the full documentation, so the root
// one is the source and this copies it into the package.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const source = path.join(rootDir, "README.md");
const target = path.join(
  rootDir,
  "packages",
  "css-selector-generator",
  "README.md",
);

// An HTML comment, so that it does not render on npm.
const banner = "<!-- Generated from the repository README. Do not edit. -->";

const content = await readFile(source, "utf-8");
await writeFile(target, `${banner}\n\n${content}`, "utf-8");

console.log("Generated the package README.");
