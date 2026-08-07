// Self-closing tags that don't have closing tags
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

// Inline elements that can stay on the same line as their content
const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'acronym', 'b', 'bdo', 'big', 'br', 'button', 'cite',
  'code', 'dfn', 'em', 'i', 'img', 'input', 'kbd', 'label', 'map',
  'object', 'q', 's', 'samp', 'select', 'small', 'span', 'strong',
  'sub', 'sup', 'textarea', 'tt', 'u', 'var'
]);

interface Token {
  type: 'open' | 'close' | 'selfclose' | 'text' | 'comment' | 'doctype';
  content: string;
  tagName?: string;
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const tagRegex = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?\s*\/?>|[^<]+/gi;

  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const text = match[0];

    if (text.startsWith('<!--')) {
      tokens.push({ type: 'comment', content: text });
    } else if (text.startsWith('<!DOCTYPE') || text.startsWith('<!doctype')) {
      tokens.push({ type: 'doctype', content: text });
    } else if (match[1]) {
      // Closing tag
      tokens.push({ type: 'close', content: text, tagName: match[1].toLowerCase() });
    } else if (match[2]) {
      // Opening or self-closing tag
      const tagName = match[2].toLowerCase();
      const isSelfClosing = text.endsWith('/>') || VOID_ELEMENTS.has(tagName);
      tokens.push({
        type: isSelfClosing ? 'selfclose' : 'open',
        content: text,
        tagName
      });
    } else {
      // Text content
      const trimmed = text.trim();
      if (trimmed) {
        tokens.push({ type: 'text', content: trimmed });
      }
    }
  }

  return tokens;
}

export function formatHtml(html: string, indentSize: number = 2): string {
  const tokens = tokenize(html);
  const lines: string[] = [];
  let indent = 0;
  const indentStr = ' '.repeat(indentSize);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const currentIndent = indentStr.repeat(indent);

    switch (token.type) {
      case 'doctype':
      case 'comment':
        lines.push(currentIndent + token.content);
        break;

      case 'selfclose':
        lines.push(currentIndent + token.content);
        break;

      case 'open': {
        const tagName = token.tagName!;
        const nextToken = tokens[i + 1];
        const afterNext = tokens[i + 2];

        // Check if this is a simple inline element: <tag>text</tag>
        const isSimpleInline =
          INLINE_ELEMENTS.has(tagName) &&
          nextToken?.type === 'text' &&
          afterNext?.type === 'close' &&
          afterNext?.tagName === tagName;

        if (isSimpleInline) {
          // Keep inline element with text on one line
          lines.push(currentIndent + token.content + nextToken.content + afterNext.content);
          i += 2; // Skip text and closing tag
        } else {
          lines.push(currentIndent + token.content);
          indent++;
        }
        break;
      }

      case 'close':
        indent = Math.max(0, indent - 1);
        lines.push(indentStr.repeat(indent) + token.content);
        break;

      case 'text':
        lines.push(currentIndent + token.content);
        break;
    }
  }

  return lines.join('\n');
}
