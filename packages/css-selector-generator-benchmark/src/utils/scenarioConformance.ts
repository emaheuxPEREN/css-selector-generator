import {
  createScenarioFrame,
  parseScenario,
  scenarios,
} from "css-selector-generator-scenarios";
import { getCssSelector } from "css-selector-generator";
import { finder } from "@medv/finder";
// @ts-ignore - CommonJS module
import uniqueSelector from "@cypress/unique-selector/lib/index.js";

const unique = uniqueSelector.default || uniqueSelector;

export type ConformanceStatus =
  "unique" | "not unique" | "error" | "unsupported";

export interface ConformanceOutcome {
  scenarioId: string;
  scenarioTitle: string;
  needleId: string;
  elementCount: number;
  status: ConformanceStatus;
  selector: string | null;
  detail: string;
}

export interface LibraryConformance {
  name: string;
  note: string;
  unique: number;
  notUnique: number;
  errors: number;
  unsupported: number;
  attempted: number;
  outcomes: ConformanceOutcome[];
}

export interface ConformanceProgress {
  scenarioId: string;
  current: number;
  total: number;
}

function isElement(node: ParentNode): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

interface LibraryDefinition {
  name: string;
  note: string;
  /** Only css-selector-generator accepts more than one element. */
  supportsMultiple: boolean;
  /**
   * Where the generated selector is resolved from. A library that cannot be
   * scoped produces a selector for the whole document, so checking it against
   * a narrower root would report failures that are not the library's fault.
   */
  searchRoot: (
    root: ParentNode | null,
    elements: Element[],
    body: Element,
  ) => ParentNode;
  generate: (
    elements: Element[],
    root: ParentNode | null,
    options: Record<string, unknown>,
    body: Element,
  ) => string;
}

function ownRoot(elements: Element[]): ParentNode {
  return elements[0].getRootNode() as ParentNode;
}

const LIBRARIES: LibraryDefinition[] = [
  {
    name: "css-selector-generator",
    note: "Scoped to the root the scenario declares.",
    supportsMultiple: true,
    searchRoot: (root, elements) => root ?? ownRoot(elements),
    // A root is passed only when the scenario declares one. Passing the
    // document explicitly is not the same as letting the library infer it,
    // and would produce different fallback selectors.
    generate: (elements, root, options) =>
      getCssSelector(
        elements.length === 1 ? elements[0] : elements,
        root ? { ...options, root } : options,
      ),
  },
  {
    name: "@medv/finder",
    note: "Needs an element root, so a shadow root cannot be used.",
    supportsMultiple: false,
    // Always given an element root. Left to default, it would validate its
    // own selectors against the page's document instead of the scenario's.
    searchRoot: (root, _elements, body) =>
      root && isElement(root) ? root : body,
    generate: (elements, root, _options, body) =>
      finder(elements[0], { root: root && isElement(root) ? root : body }),
  },
  {
    name: "@cypress/unique-selector",
    note: "No root option, so selectors are resolved against the document.",
    supportsMultiple: false,
    searchRoot: (_root, elements) => ownRoot(elements),
    generate: (elements) => unique(elements[0]),
  },
];

function check(
  selector: string,
  searchRoot: ParentNode,
  elements: Element[],
): { status: ConformanceStatus; detail: string } {
  let matched: Element[];
  try {
    matched = Array.from(searchRoot.querySelectorAll(selector));
  } catch {
    return { status: "error", detail: "selector is not valid" };
  }
  const missing = elements.filter((element) => !matched.includes(element));
  if (matched.length === elements.length && missing.length === 0) {
    return { status: "unique", detail: "" };
  }
  // Equal counts with a missing target means the selector landed on some other
  // element, which is a different failure from matching too many.
  return {
    status: "not unique",
    detail:
      missing.length > 0 && matched.length === elements.length
        ? "resolved to a different element"
        : `resolved to ${matched.length}, expected ${elements.length}`,
  };
}

export async function runScenarioConformance(
  onProgress?: (progress: ConformanceProgress) => void,
): Promise<LibraryConformance[]> {
  const results: LibraryConformance[] = LIBRARIES.map((library) => ({
    name: library.name,
    note: library.note,
    unique: 0,
    notUnique: 0,
    errors: 0,
    unsupported: 0,
    attempted: 0,
    outcomes: [],
  }));

  for (const [index, scenario] of scenarios.entries()) {
    onProgress?.({
      scenarioId: scenario.id,
      current: index + 1,
      total: scenarios.length,
    });
    // Yields to the browser, so the progress above is actually painted.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const iframe = await createScenarioFrame(scenario.html, document);
    try {
      const doc = iframe.contentDocument;
      if (!doc) continue;
      const parsed = parseScenario(doc.body);

      for (const needle of parsed.needles) {
        if (needle.elements.length === 0) continue;
        const declaredRoot = needle.root;

        LIBRARIES.forEach((library, libraryIndex) => {
          const result = results[libraryIndex];
          const base = {
            scenarioId: scenario.id,
            scenarioTitle: scenario.title ?? scenario.id,
            needleId: needle.id,
            elementCount: needle.elements.length,
          };

          if (needle.elements.length > 1 && !library.supportsMultiple) {
            result.unsupported++;
            result.outcomes.push({
              ...base,
              status: "unsupported",
              selector: null,
              detail: "cannot target more than one element",
            });
            return;
          }

          result.attempted++;

          let selector: string;
          try {
            selector = library.generate(
              needle.elements,
              declaredRoot,
              parsed.metadata.options,
              doc.body,
            );
          } catch (error) {
            result.errors++;
            result.outcomes.push({
              ...base,
              status: "error",
              selector: null,
              detail: error instanceof Error ? error.message : "threw",
            });
            return;
          }

          const { status, detail } = check(
            selector,
            library.searchRoot(declaredRoot, needle.elements, doc.body),
            needle.elements,
          );

          if (status === "unique") {
            result.unique++;
          } else if (status === "error") {
            result.errors++;
          } else {
            result.notUnique++;
          }

          result.outcomes.push({ ...base, status, selector, detail });
        });
      }
    } finally {
      iframe.remove();
    }
  }

  return results;
}
