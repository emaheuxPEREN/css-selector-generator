import type { ScenarioOptions } from "./types.js";

// Keys are bare identifiers, so that a value may itself contain the divider
// character. A greedy key would split on the LAST divider instead, which
// breaks escaped selectors (`.aaa\:bbb`) and attribute values holding URLs
// (`[href='http://example.com']`).
const COMMENT_SPLITTER = /^\s*(?<key>[A-Za-z][\w-]*)\s*:\s*(?<val>.*\S)\s*$/;
const EXPECTATION_SPLITTER = /^\s*(?<key>[\w-]+)\s*;\s*(?<val>.*\S)\s*$/;

function splitContent(content: string, re: RegExp): [string | null, string] {
  const match = content.match(re);
  if (!match?.groups) {
    return [null, content];
  }
  const { key, val } = match.groups;
  return [key.trim(), val.trim()];
}

interface ScenarioExpectationItem {
  element?: Element;
  identifier?: string;
  expectation?: string;
  negative?: boolean;
}

export function parseCommentContent(
  content: string,
): ScenarioExpectationItem | null {
  const [key, val] = splitContent(content, COMMENT_SPLITTER);
  if (key === "expect" || key === "expect-not") {
    const negative = key === "expect-not" ? { negative: true } : {};
    const [identifier, expectation] = splitContent(val, EXPECTATION_SPLITTER);
    if (identifier && expectation) {
      return { identifier, expectation, ...negative };
    } else {
      return { expectation, ...negative };
    }
  }
  if (key === "identifier") {
    return { identifier: val };
  }
  return null;
}

export function parseComment(comment: Comment): ScenarioExpectationItem | null {
  const result = parseCommentContent(comment.textContent);
  if (result) {
    if (!result.expectation || !result.identifier) {
      // Null for a comment that is a direct child of a document or fragment.
      result.element = comment.parentElement ?? undefined;
    }
    return result;
  }
  return null;
}

export interface ScenarioMetadata {
  title: string | null;
  description: string | null;
  tags: string[];
  options: ScenarioOptions;
}

function emptyMetadata(): ScenarioMetadata {
  return { title: null, description: null, tags: [], options: {} };
}

/**
 * Front matter is a comment whose first line is the bare word `scenario`,
 * followed by `key: value` lines. Only the scenario's first comment is
 * considered.
 */
export function parseFrontMatterContent(
  content: string,
): ScenarioMetadata | null {
  const lines = content.split("\n");
  const firstLine = lines.findIndex((line) => line.trim() !== "");
  if (firstLine === -1 || lines[firstLine].trim() !== "scenario") {
    return null;
  }

  const metadata = emptyMetadata();

  lines.slice(firstLine + 1).forEach((line) => {
    const [key, val] = splitContent(line, COMMENT_SPLITTER);
    if (key === "title") {
      metadata.title = val;
    }
    if (key === "description") {
      metadata.description = val;
    }
    if (key === "tags") {
      metadata.tags = val
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== "");
    }
    if (key === "options") {
      try {
        metadata.options = JSON.parse(val) as ScenarioOptions;
      } catch {
        throw new Error(`Scenario has invalid JSON in "options": ${val}`);
      }
    }
  });

  return metadata;
}

/** One or more elements a selector is generated for. */
export interface ScenarioNeedle {
  id: string;
  elements: Element[];
  root: ParentNode | null;
}

export interface ScenarioExpectation {
  needleId: string;
  selector: string;
  /** The generated selector must differ from `selector`. */
  negative: boolean;
}

export interface ParsedScenario {
  metadata: ScenarioMetadata;
  needles: ScenarioNeedle[];
  expectations: ScenarioExpectation[];
}

function isCommentNode(node: Node): node is Comment {
  return node.nodeType === Node.COMMENT_NODE;
}

// Avoids `instanceof`, which does not hold across documents.
function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in node;
}

/** Nearest ancestor marked with `<!-- root -->`, crossing shadow boundaries. */
function findNeedleRoot(element: Element, roots: Set<Node>): ParentNode | null {
  let node = element.parentNode;
  while (node) {
    if (roots.has(node)) {
      return node;
    }
    node = isShadowRoot(node) ? node.host : node.parentNode;
  }
  return null;
}

function forEachComment(
  root: Element | ShadowRoot,
  callback: (comment: Comment) => void,
): void {
  // The root may belong to another document, e.g. an iframe.
  const iterator = root.ownerDocument.createNodeIterator(
    root,
    NodeFilter.SHOW_COMMENT,
    { acceptNode: () => NodeFilter.FILTER_ACCEPT },
  );
  let currentNode: Node | null;
  while ((currentNode = iterator.nextNode())) {
    if (isCommentNode(currentNode)) {
      callback(currentNode);
    }
  }

  // A node iterator does not cross shadow boundaries. Only open shadow roots
  // are reachable, so scenarios cannot cover closed ones.
  root.querySelectorAll("*").forEach((element) => {
    if (element.shadowRoot) {
      forEachComment(element.shadowRoot, callback);
    }
  });
}

export function parseScenario(rootElement: Element): ParsedScenario {
  const needles: ScenarioNeedle[] = [];
  const expectations: ScenarioExpectation[] = [];
  const needlesById = new Map<string, ScenarioNeedle>();
  const roots = new Set<Node>();
  let metadata = emptyMetadata();
  let isFirstComment = true;
  let inlineCount = 0;

  function getNeedle(id: string): ScenarioNeedle {
    let needle = needlesById.get(id);
    if (!needle) {
      needle = { id, elements: [], root: null };
      needlesById.set(id, needle);
      needles.push(needle);
    }
    return needle;
  }

  forEachComment(rootElement, (comment) => {
    if (isFirstComment) {
      isFirstComment = false;
      const frontMatter = parseFrontMatterContent(comment.textContent);
      if (frontMatter) {
        metadata = frontMatter;
        return;
      }
    }

    // `parentNode` rather than `parentElement`, so that a comment placed
    // directly in a shadow root marks that shadow root.
    if (comment.textContent.trim() === "root" && comment.parentNode) {
      roots.add(comment.parentNode);
      return;
    }

    const parsed = parseComment(comment);
    if (!parsed) {
      return;
    }
    const { element, identifier, expectation, negative = false } = parsed;

    if (identifier && expectation) {
      // Deliberately does not create the needle, so that an expectation
      // naming an identifier that was never applied is reported rather than
      // silently dropped.
      expectations.push({
        needleId: identifier,
        selector: expectation,
        negative,
      });
      return;
    }
    if (!element) {
      return;
    }
    if (identifier) {
      getNeedle(identifier).elements.push(element);
      return;
    }
    if (expectation) {
      // `#` cannot occur in an authored identifier, so this cannot collide.
      const id = `#${String(inlineCount++)}`;
      getNeedle(id).elements.push(element);
      expectations.push({ needleId: id, selector: expectation, negative });
    }
  });

  // Resolved after the walk, so that a `<!-- root -->` may appear anywhere.
  needles.forEach((needle) => {
    if (needle.elements.length > 0) {
      needle.root = findNeedleRoot(needle.elements[0], roots);
    }
  });

  return { metadata, needles, expectations };
}
