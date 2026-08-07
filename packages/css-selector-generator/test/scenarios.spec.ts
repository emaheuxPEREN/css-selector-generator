import { assert } from "chai";
import {
  createScenarioFrame,
  parseScenario,
  scenarios,
} from "css-selector-generator-scenarios";
import type { ParsedScenario } from "css-selector-generator-scenarios";
import { getCssSelector } from "../src";
import type { CssSelectorGeneratorOptionsInput } from "../src/types.js";

interface GeneratedNeedle {
  id: string;
  elements: Element[];
  searchRoot: ParentNode;
  selector: string;
}

function generateForNeedles(
  scenario: ParsedScenario,
  options: CssSelectorGeneratorOptionsInput,
): GeneratedNeedle[] {
  return scenario.needles
    .filter(({ elements }) => elements.length > 0)
    .map(({ id, elements, root }) => ({
      id,
      elements,
      searchRoot: (root ?? elements[0].getRootNode()) as ParentNode,
      selector: getCssSelector(
        elements.length === 1 ? elements[0] : elements,
        root ? { ...options, root } : options,
      ),
    }));
}

describe("scenarios", () => {
  scenarios.forEach((scenario) => {
    describe(scenario.id, () => {
      const options = scenario.options as CssSelectorGeneratorOptionsInput;
      let iframe: HTMLIFrameElement;
      let parsed: ParsedScenario;
      let generated: GeneratedNeedle[];

      beforeEach(async () => {
        iframe = await createScenarioFrame(scenario.html, document);
        const scenarioDocument = iframe.contentDocument;
        if (!scenarioDocument) {
          throw new Error("Could not access the scenario iframe document.");
        }
        parsed = parseScenario(scenarioDocument.body);
        generated = generateForNeedles(parsed, options);
      });

      afterEach(() => {
        iframe.remove();
      });

      it("should assert something", () => {
        assert.isAbove(
          parsed.expectations.length,
          0,
          "scenario declares no expectation, so it would pass vacuously",
        );
      });

      it("should resolve every generated selector to its own elements", () => {
        generated.forEach(({ id, elements, searchRoot, selector }) => {
          let matched: Element[];
          try {
            matched = Array.from(searchRoot.querySelectorAll(selector));
          } catch {
            assert.fail(`needle "${id}" produced an invalid selector`);
          }
          assert.deepEqual(
            matched,
            elements,
            `needle "${id}": ${selector} did not resolve to its own elements`,
          );
        });
      });

      it("should match its expectations", () => {
        const selectorsByNeedle = new Map(
          generated.map(({ id, selector }) => [id, selector]),
        );

        parsed.expectations.forEach(({ needleId, selector, negative }) => {
          const actual = selectorsByNeedle.get(needleId);
          assert.isDefined(
            actual,
            `no element carries the identifier "${needleId}"`,
          );
          if (negative) {
            assert.notEqual(actual, selector);
          } else {
            assert.equal(actual, selector);
          }
        });
      });
    });
  });
});
