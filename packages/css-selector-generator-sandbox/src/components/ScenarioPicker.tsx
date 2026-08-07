import type { Scenario } from "css-selector-generator-scenarios";

interface ScenarioPickerProps {
  scenarios: Scenario[];
  value: string;
  onChange: (id: string) => void;
}

export function ScenarioPicker({
  scenarios,
  value,
  onChange,
}: ScenarioPickerProps) {
  const selected = scenarios.find((scenario) => scenario.id === value);

  return (
    <div className="scenario-picker">
      <label>
        Scenario
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Sample</option>
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.title ?? scenario.id}
            </option>
          ))}
        </select>
      </label>
      {selected?.description && (
        <p className="scenario-description">{selected.description}</p>
      )}
    </div>
  );
}
