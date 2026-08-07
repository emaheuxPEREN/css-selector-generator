import { useState, useEffect } from "react";
import {
  createScenarioFrame,
  scenarios,
} from "css-selector-generator-scenarios";
import { HtmlEditor } from "./components/HtmlEditor";
import { SelectorPanel } from "./components/SelectorPanel";
import { ScenarioPicker } from "./components/ScenarioPicker";
import {
  mapSelectorsToLines,
  getLineCount,
  type SelectorWithTiming,
} from "./utils/selectorMapper";
import { formatHtml } from "./utils/formatHtml";

// The line mapper pairs source tags with elements found by walking the
// rendered DOM, which cannot see into shadow roots.
const PICKABLE_SCENARIOS = scenarios.filter(
  (scenario) => !scenario.tags.includes("shadow-dom"),
);

const SAMPLE_HTML = `<section class="demo">
  <article>
    This article tag is unique, so selector is just: article
  </article>

  <div class="unique-class">
    This div has a unique class, so selector is: .unique-class
  </div>

  <div class="shared specific">
    This div needs multiple classes for uniqueness: .shared.specific
  </div>
  <div class="shared other">
    The "shared" class alone is not unique.
  </div>
  <div class="specific another">
    The "specific" class alone is not unique either.
  </div>

  <div class="parent">
    <div class="child">
      This needs ancestor context: .parent .child
    </div>
  </div>
  <div class="other-parent">
    <div class="child">
      The "child" class is not unique without parent.
    </div>
  </div>

  <div class="fallback-examples">
    <div>
      It is not possible to generate nicer selectors for these elements, so we generate a fallback selector, which uses chain of :nth-child descendants from the root to the element, to make it unique.
    </div>
    <div>
      Another element requiring fallback selector.
    </div>
    <div>
      Third fallback example.
    </div>
  </div>
</section>`;

function App() {
  const [htmlSource, setHtmlSource] = useState(SAMPLE_HTML);
  const [selectorsByLine, setSelectorsByLine] = useState<
    Map<number, SelectorWithTiming[]>
  >(new Map());
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [showInfoPopover, setShowInfoPopover] = useState(false);
  const [scenarioId, setScenarioId] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Loaded the same way as in the library's tests, so that the document
      // shape matches. Selectors can still differ from a scenario's stated
      // expectation, because everything here is generated against the body.
      const iframe = await createScenarioFrame(htmlSource, document);
      try {
        const doc = iframe.contentDocument;
        if (!doc || cancelled) return;
        const result = mapSelectorsToLines(htmlSource, doc.body);
        setSelectorsByLine(result.selectorsByLine);
        setTotalTimeMs(result.totalTimeMs);
      } finally {
        iframe.remove();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [htmlSource]);

  const handleScenarioChange = (id: string) => {
    setScenarioId(id);
    const scenario = PICKABLE_SCENARIOS.find((item) => item.id === id);
    setHtmlSource(scenario ? scenario.html.trim() : SAMPLE_HTML);
  };

  const lineCount = getLineCount(htmlSource);

  // Calculate total element count
  const elementCount = Array.from(selectorsByLine.values()).reduce(
    (total, selectors) => total + selectors.length,
    0,
  );

  const handleFormat = () => {
    setHtmlSource(formatHtml(htmlSource));
  };

  return (
    <div className="app">
      <div className="app-title">
        <h1>CSS Selector Generator Sandbox</h1>
        <p>
          A playground for testing{" "}
          <a href="https://github.com/fczbkk/css-selector-generator#readme">
            css-selector-generator
          </a>
          , a JavaScript library that generates unique CSS selectors for any
          HTML element.
        </p>
      </div>
      <div className="panels-content">
        <div className="panel-column">
          <div className="panel-header">
            HTML
            <button className="format-btn" onClick={handleFormat}>
              Format
            </button>
          </div>
          <ScenarioPicker
            scenarios={PICKABLE_SCENARIOS}
            value={scenarioId}
            onChange={handleScenarioChange}
          />
          <HtmlEditor value={htmlSource} onChange={setHtmlSource} />
        </div>
        <div className="panel-column">
          <div className="panel-header">
            CSS Selectors
            <span className="total-time">
              {elementCount} elements, {totalTimeMs.toFixed(2)} ms
              <button
                className="info-btn"
                onClick={() => setShowInfoPopover(!showInfoPopover)}
              >
                i
              </button>
              {showInfoPopover && (
                <div className="info-popover">
                  <p>Total time to generate all CSS selectors.</p>
                  <p>
                    Hover over individual selectors to see their generation
                    time.
                  </p>
                </div>
              )}
            </span>
          </div>
          <SelectorPanel
            selectorsByLine={selectorsByLine}
            lineCount={lineCount}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
