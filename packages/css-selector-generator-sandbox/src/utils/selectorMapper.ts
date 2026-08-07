import { getCssSelector } from 'css-selector-generator';

interface TagInfo {
  tagName: string;
  lineNumber: number;
}

// Convert character position to line number
function positionToLine(source: string, position: number): number {
  let line = 0;
  for (let i = 0; i < position && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
    }
  }
  return line;
}

// Find all comment ranges in the source
function findCommentRanges(htmlSource: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const commentRegex = /<!--[\s\S]*?-->/g;

  let match;
  while ((match = commentRegex.exec(htmlSource)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }

  return ranges;
}

// Check if a position is inside any comment range
function isInsideComment(position: number, commentRanges: Array<[number, number]>): boolean {
  for (const [start, end] of commentRanges) {
    if (position >= start && position < end) {
      return true;
    }
  }
  return false;
}

// Parse HTML source to find all opening tags and their line numbers
function parseOpeningTags(htmlSource: string): TagInfo[] {
  const tags: TagInfo[] = [];
  const commentRanges = findCommentRanges(htmlSource);

  // Match opening tags (including self-closing)
  // Regex requires letter after <, so closing tags (</tag>) won't match
  const tagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;

  let match;
  while ((match = tagRegex.exec(htmlSource)) !== null) {
    // Skip tags inside HTML comments
    if (isInsideComment(match.index, commentRanges)) {
      continue;
    }

    tags.push({
      tagName: match[1].toLowerCase(),
      lineNumber: positionToLine(htmlSource, match.index),
    });
  }

  return tags;
}

// Get all elements from a container in document order
function getAllElements(container: Element): Element[] {
  const elements: Element[] = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  let node = walker.nextNode();
  while (node) {
    elements.push(node as Element);
    node = walker.nextNode();
  }

  return elements;
}

export interface SelectorWithTiming {
  selector: string;
  timeMs: number;
}

export interface MapSelectorsResult {
  selectorsByLine: Map<number, SelectorWithTiming[]>;
  totalTimeMs: number;
}

// Main function: map HTML source to CSS selectors by line number
export function mapSelectorsToLines(
  htmlSource: string,
  container: Element
): MapSelectorsResult {
  const selectorsByLine = new Map<number, SelectorWithTiming[]>();
  const totalStart = performance.now();

  if (!htmlSource.trim()) {
    return { selectorsByLine, totalTimeMs: 0 };
  }

  // Parse source to get tag positions
  const tagInfos = parseOpeningTags(htmlSource);

  // Get all elements from the rendered container
  const elements = getAllElements(container);

  // Match elements to their source positions
  // We track tag index per tag name to handle matching
  const tagCounters: Record<string, number> = {};

  // Build a map: for each tag name, list of line numbers where it appears
  const tagLineMap: Record<string, number[]> = {};
  for (const info of tagInfos) {
    if (!tagLineMap[info.tagName]) {
      tagLineMap[info.tagName] = [];
    }
    tagLineMap[info.tagName].push(info.lineNumber);
  }

  // For each DOM element, find its corresponding source line
  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();

    // Initialize counter for this tag name if needed
    if (tagCounters[tagName] === undefined) {
      tagCounters[tagName] = 0;
    }

    const tagIndex = tagCounters[tagName];
    const linesForTag = tagLineMap[tagName] || [];

    if (tagIndex < linesForTag.length) {
      const lineNumber = linesForTag[tagIndex];

      // Generate CSS selector for this element with timing
      try {
        const start = performance.now();
        const selector = getCssSelector(element, { root: container });
        const timeMs = performance.now() - start;

        if (!selectorsByLine.has(lineNumber)) {
          selectorsByLine.set(lineNumber, []);
        }
        selectorsByLine.get(lineNumber)!.push({ selector, timeMs });
      } catch (e) {
        // Skip elements that can't generate selectors
      }
    }

    tagCounters[tagName]++;
  }

  const totalTimeMs = performance.now() - totalStart;
  return { selectorsByLine, totalTimeMs };
}

// Get total line count from source
export function getLineCount(htmlSource: string): number {
  if (!htmlSource) return 0;
  return htmlSource.split('\n').length;
}
