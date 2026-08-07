import type { SelectorWithTiming } from '../utils/selectorMapper';

interface SelectorPanelProps {
  selectorsByLine: Map<number, SelectorWithTiming[]>;
  lineCount: number;
}

export function SelectorPanel({ selectorsByLine, lineCount }: SelectorPanelProps) {
  const lines = [];

  for (let i = 0; i < lineCount; i++) {
    const selectors = selectorsByLine.get(i) || [];
    lines.push(
      <div key={i} className="selector-line">
        {selectors.map((s, idx) => (
          <span key={idx} className="selector" title={`${s.timeMs.toFixed(3)} ms`}>
            {s.selector}
            {idx < selectors.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>
    );
  }

  return <div className="selector-panel">{lines}</div>;
}
