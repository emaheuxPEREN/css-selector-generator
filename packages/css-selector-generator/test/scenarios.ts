/* eslint no-console: 0 */

import { URL } from "node:url";
import * as path from "node:path";
import { build } from "esbuild";
import chalk from "chalk";

import { chromium } from "playwright";
import type { Page } from "playwright";
import type getCssSelector from "../src";
import type * as ScenarioUtilities from "css-selector-generator-scenarios";
import type { ParsedScenario } from "css-selector-generator-scenarios";
import { scenarios } from "css-selector-generator-scenarios";
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

async function getTestEnvironment() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", consoleMessageToTerminal);

  // inject scenario utilities
  await buildAndInsertScript(
    {
      srcPath: path.resolve(
        __dirname,
        "../../css-selector-generator-scenarios/src/index.ts",
      ),
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
    const iframe = await scenarioUtilities.createScenarioFrame(
      content,
      document,
    );

    const doc = iframe.contentDocument;
    if (!doc) {
      throw new Error("Could not access the scenario iframe document.");
    }

    try {
      const scenario: ParsedScenario = scenarioUtilities.parseScenario(
        doc.body,
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

      const generatedByNeedle = new Map<string, string>();

      scenario.needles.forEach(({ id, elements, root }) => {
        if (elements.length === 0) {
          return;
        }
        const generatedSelector = CssSelectorGenerator.getCssSelector(
          elements.length === 1 ? elements[0] : elements,
          root
            ? { ...scenario.metadata.options, root }
            : scenario.metadata.options,
        );
        generatedByNeedle.set(id, generatedSelector);

        // Every generated selector must resolve back to exactly the elements
        // it was generated for, searched from the same root the generator
        // used. This catches malformed and under-specified selectors that an
        // expected-string comparison cannot express.
        const searchRoot = (root ?? elements[0].getRootNode()) as ParentNode;
        let matched: Element[];
        try {
          matched = Array.from(searchRoot.querySelectorAll(generatedSelector));
        } catch {
          result.error.push({
            key: id,
            expectation: "a valid selector",
            selector: generatedSelector,
          });
          return;
        }

        const isExact =
          matched.length === elements.length &&
          elements.every((element) => matched.includes(element));
        if (isExact) {
          result.success.push({
            key: id,
            expectation: "resolves to its own elements",
            selector: generatedSelector,
          });
        } else {
          result.error.push({
            key: id,
            expectation: `to resolve to its own ${String(elements.length)} element(s)`,
            selector: `${generatedSelector} resolved to ${String(matched.length)}`,
          });
        }
      });

      scenario.expectations.forEach(({ needleId, selector, negative }) => {
        const generatedSelector = generatedByNeedle.get(needleId);
        if (generatedSelector === undefined) {
          result.error.push({
            key: selector,
            expectation: selector,
            selector: `no element carries the identifier "${needleId}"`,
          });
          return;
        }

        const matches = selector === generatedSelector;
        result[matches !== negative ? "success" : "error"].push({
          expectation: negative ? `anything but ${selector}` : selector,
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

async function testAllScenarios() {
  // TODO try to use Assert node module for the reporting
  const { page, browser } = await getTestEnvironment();

  const scenarioErrors: Record<string, ScenarioTestResultItem[]> = {};

  for (const scenario of scenarios) {
    const scenarioFile = scenario.id;
    const scenarioData = await testScenario(scenario.html, page);
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
