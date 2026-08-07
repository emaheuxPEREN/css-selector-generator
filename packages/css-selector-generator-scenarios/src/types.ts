/**
 * Options passed to the selector generator. Deliberately untyped against any
 * particular generator, so that scenarios can be run against several of them.
 */
export type ScenarioOptions = Record<string, unknown>;

export interface Scenario {
  /** File name without the extension. */
  id: string;
  title: string | null;
  description: string | null;
  tags: string[];
  options: ScenarioOptions;
  html: string;
}
