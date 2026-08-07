/* eslint no-console: 0 */

import path from "node:path";
import fs from "node:fs";

// Run from a workspace package, `npm version` takes its workspace code path,
// which forces `git-tag-version` off. That silently skips the commit, the tag
// and the clean-tree check, while `postversion` still publishes. Releasing has
// to go through the root `release` script, whose `--prefix` lands here.
function realPath(input) {
  try {
    return fs.realpathSync(input);
  } catch {
    return path.resolve(input);
  }
}

const packageDir = realPath(path.resolve(import.meta.dirname, ".."));
const prefix = process.env.npm_config_prefix;

if (!prefix || realPath(prefix) !== packageDir) {
  console.error(
    "Refusing to version this package directly.\n" +
      "Run `npm run release -- <patch|minor|major>` from the monorepo root.",
  );
  process.exit(1);
}
