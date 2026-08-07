/**
 * Renders scenario HTML into a fresh iframe and resolves once it is parsed.
 *
 * Written as a complete document through the HTML parser: fallback selectors
 * encode the document structure, and declarative shadow DOM is only parsed
 * this way. Every consumer has to load scenarios through this, otherwise the
 * same scenario produces different selectors in different hosts.
 */
export async function createScenarioFrame(
  html: string,
  hostDocument: Document,
): Promise<HTMLIFrameElement> {
  const iframe = hostDocument.createElement("iframe");
  iframe.srcdoc = `<!DOCTYPE html><html lang="en"><head></head><body>${html}</body></html>`;
  const loaded = new Promise<void>((resolve) => {
    iframe.addEventListener("load", () => {
      resolve();
    });
  });
  hostDocument.body.appendChild(iframe);
  await loaded;
  return iframe;
}
