import { parseScenario } from "css-selector-generator-scenarios";

export function createRoot() {
  return document.body.appendChild(document.createElement("div"));
}

/**
 * Simple way to retrieve target element for test.
 * @returns {Element}
 */
export function getTargetElement(root: Element): Element {
  return root.querySelector("[data-target]");
}

/**
 * Simple way to retrieve multiple target elements for test.
 * @returns {Element[]}
 */
export function getTargetElements(root: Element): Element[] {
  return [...root.querySelectorAll("[data-target]")];
}

export interface TestScenario {
  root: Element;
  /** Single element carrying `<!-- identifier: id -->`. */
  needle: (id: string) => Element;
  /** Every element carrying `<!-- identifier: id -->`. */
  needles: (id: string) => Element[];
  expectation: (id: string) => string | undefined;
}

export function parseTestHtml(html: string): TestScenario {
  const root = document.createElement("div");
  root.innerHTML = html;
  const parsed = parseScenario(root);

  const elementsById = new Map(
    parsed.needles.map((needle) => [needle.id, needle.elements]),
  );

  function needles(id: string): Element[] {
    return elementsById.get(id) ?? [];
  }

  return {
    root,
    needles,
    needle: (id) => {
      const elements = needles(id);
      if (elements.length === 0) {
        throw new Error(`No element carries the identifier "${id}".`);
      }
      return elements[0];
    },
    expectation: (id) =>
      parsed.expectations.find(({ needleId }) => needleId === id)?.selector,
  };
}
