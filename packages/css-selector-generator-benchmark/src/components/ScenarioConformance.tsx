import { useState } from "react";
import type { LibraryConformance } from "../utils/scenarioConformance";

interface ScenarioConformanceProps {
  results: LibraryConformance[];
}

export function ScenarioConformance({ results }: ScenarioConformanceProps) {
  const [showFailures, setShowFailures] = useState(false);

  const failures = results.flatMap((library) =>
    library.outcomes
      .filter((outcome) => outcome.status !== "unique")
      .map((outcome) => ({ library: library.name, ...outcome })),
  );

  return (
    <div className="scenario-conformance">
      <h2>Scenario conformance</h2>
      <p>
        Every scenario is loaded and a selector is generated for each of its
        target elements. A selector passes only if it resolves back to exactly
        those elements.
      </p>

      <table>
        <thead>
          <tr>
            <th>Metric</th>
            {results.map((library) => (
              <th key={library.name}>{library.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Targets attempted</td>
            {results.map((library) => (
              <td key={library.name}>{library.attempted}</td>
            ))}
          </tr>
          <tr>
            <td>Resolved uniquely</td>
            {results.map((library) => (
              <td
                key={library.name}
                className={
                  library.attempted > 0 && library.unique === library.attempted
                    ? "good"
                    : "bad"
                }
              >
                {library.unique}
                {library.attempted > 0 &&
                  ` (${((library.unique / library.attempted) * 100).toFixed(1)}%)`}
              </td>
            ))}
          </tr>
          <tr>
            <td>Did not resolve</td>
            {results.map((library) => (
              <td key={library.name}>{library.notUnique}</td>
            ))}
          </tr>
          <tr>
            <td>Errors</td>
            {results.map((library) => (
              <td key={library.name}>{library.errors}</td>
            ))}
          </tr>
          <tr>
            <td>Not supported</td>
            {results.map((library) => (
              <td key={library.name}>{library.unsupported}</td>
            ))}
          </tr>
          <tr>
            <td>Notes</td>
            {results.map((library) => (
              <td key={library.name} className="note">
                {library.note}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {failures.length > 0 && (
        <>
          <label className="conformance-toggle">
            <input
              type="checkbox"
              checked={showFailures}
              onChange={(event) => setShowFailures(event.target.checked)}
            />
            Show the {failures.length} target(s) that did not resolve
          </label>

          {showFailures && (
            <table>
              <thead>
                <tr>
                  <th>Library</th>
                  <th>Scenario</th>
                  <th>Status</th>
                  <th>Selector</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((failure, index) => (
                  <tr key={index}>
                    <td>{failure.library}</td>
                    <td>{failure.scenarioTitle}</td>
                    <td>{failure.status}</td>
                    <td>
                      <code>{failure.selector ?? "—"}</code>
                    </td>
                    <td>{failure.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
