/* eslint no-console: 0 */

import { URL } from "node:url";
import * as path from "node:path";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import chalk from "chalk";

import { chromium } from "playwright";
import type { Page } from "playwright";
import type getCssSelector from "../src";
import type * as ScenarioUtilities from "./scenario-utilities";
import type { ParsedScenario } from "./scenario-utilities";
import { glob } from "glob";
import { consoleMessageToTerminal } from "../playwright-tests/utilities";

interface ScenarioTestResultItem {
  key: string;
  expectation: string;
  selector: string;
}

interface ScenarioTestResult {
  success: ScenarioTestResultItem[];
  error: ScenarioTestResultItem[];
}

declare global {
  interface CssSelectorGenerator {
    getCssSelector: typeof getCssSelector;
  }
  const CssSelectorGenerator: CssSelectorGenerator;
  const scenarioUtilities: typeof ScenarioUtilities;
}

const __dirname = new URL(".", import.meta.url).pathname;
const scenariosDir = path.resolve(__dirname, "../scenario");

async function getTestEnvironment() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", consoleMessageToTerminal);

  // inject test utilities
  await buildAndInsertScript(
    {
      srcPath: path.resolve(__dirname, "./scenario-utilities.ts"),
      buildPath: path.resolve(
        __dirname,
        "../temp/scenarios/scenario-utilities.js",
      ),
      globalName: "scenarioUtilities",
    },
    page,
  );

  // inject the library
  await buildAndInsertScript(
    {
      srcPath: path.resolve(__dirname, "../src/index.ts"),
      buildPath: path.resolve(__dirname, "../temp/scenarios/index.js"),
      globalName: "CssSelectorGenerator",
    },
    page,
  );

  return {
    page,
    browser,
  };
}

async function testScenario(
  scenarioContent: string,
  page: Page,
): Promise<ScenarioTestResult> {
  return page.evaluate(async (content: string) => {
    // Written as a complete document through the HTML parser: fallback
    // selectors encode the document structure, and declarative shadow DOM is
    // only parsed this way.
    const iframe = document.createElement("iframe");
    iframe.srcdoc = `<!DOCTYPE html><html lang="en"><head></head><body>${content}</body></html>`;
    const loaded = new Promise<void>((resolve) => {
      iframe.addEventListener("load", () => {
        resolve();
      });
    });
    document.body.appendChild(iframe);
    await loaded;

    const doc = iframe.contentDocument;
    if (!doc) {
      throw new Error("Could not access the scenario iframe document.");
    }

    try {
      const scenario: ParsedScenario = scenarioUtilities.parseScenario(
        doc.body,
      );
      const needlesById = new Map(
        scenario.needles.map((needle) => [needle.id, needle]),
      );

      const result: ScenarioTestResult = {
        success: [],
        error: [],
      };

      if (scenario.expectations.length === 0) {
        result.error.push({
          key: "scenario",
          expectation: "at least one expectation",
          selector: "none found",
        });
      }

      scenario.expectations.forEach(({ needleId, selector }) => {
        const needle = needlesById.get(needleId);
        if (!needle || needle.elements.length === 0) {
          result.error.push({
            key: selector,
            expectation: selector,
            selector: `no element carries the identifier "${needleId}"`,
          });
          return;
        }

        const { elements, root } = needle;
        const generatedSelector = CssSelectorGenerator.getCssSelector(
          elements.length === 1 ? elements[0] : elements,
          root
            ? { ...scenario.metadata.options, root }
            : scenario.metadata.options,
        );
        result[selector === generatedSelector ? "success" : "error"].push({
          expectation: selector,
          selector: generatedSelector,
          key: selector,
        });
      });

      return result;
    } finally {
      iframe.remove();
    }
  }, scenarioContent);
}

interface BuildScriptProps {
  srcPath: string;
  buildPath: string;
  globalName: string;
}

async function buildAndInsertScript(props: BuildScriptProps, page: Page) {
  const { buildPath } = props;
  await buildScript(props);
  return await page.addScriptTag({ path: buildPath });
}

// Uses EsBuild, builds a single file script optimized to be injected into the browser environment.
async function buildScript({
  srcPath,
  buildPath,
  globalName,
}: BuildScriptProps) {
  return await build({
    entryPoints: [srcPath],
    outfile: buildPath,
    bundle: true,
    format: "iife",
    globalName: globalName,
    platform: "browser",
  });
}

async function getScenariosFiles() {
  return glob("**/*.html", {
    cwd: scenariosDir,
  });
}

async function testAllScenarios() {
  // TODO try to use Assert node module for the reporting
  const { page, browser } = await getTestEnvironment();

  const scenarioErrors: Record<string, ScenarioTestResultItem[]> = {};

  const scenarioFiles = await getScenariosFiles();

  for (const scenarioFile of scenarioFiles) {
    const scenarioFilePath = path.resolve(scenariosDir, scenarioFile);
    const scenarioContent = await readFile(scenarioFilePath, "utf-8");
    const scenarioData = await testScenario(scenarioContent, page);
    const { error } = scenarioData;

    if (error.length > 0) {
      scenarioErrors[scenarioFile] = scenarioData.error;
      console.log(`${chalk.red.bold("✗")} ${chalk.red(scenarioFile)}`);
    } else {
      console.log(`${chalk.green.bold("✓")} ${chalk.green(scenarioFile)}`);
    }
  }

  const hasErrors = Object.keys(scenarioErrors).length > 0;

  if (hasErrors) {
    console.log("\nFOUND ERRORS\n");

    for (const [filePath, errors] of Object.entries(scenarioErrors)) {
      console.log(filePath);
      errors.forEach(({ key, expectation, selector }) => {
        console.log(` - ${key}`);
        console.log(`      found: ${chalk.bold.red(selector)}`);
        console.log(`   expected: ${chalk.bold(expectation)}`);
      });
    }
  }

  await browser.close();
  return hasErrors;
}

const hasErrors = await testAllScenarios();
process.exit(hasErrors ? 1 : 0);
