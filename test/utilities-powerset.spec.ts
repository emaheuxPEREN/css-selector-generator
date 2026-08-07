import { assert } from "chai";
import { getPowerSet, powerSetGenerator } from "../src/utilities-powerset";

/**
 * Independent reference implementation, non-optimized.
 */
function referencePowerSet<T>(input: T[]): T[][] {
  const result: T[][] = [];
  const combos = (size: number, start: number, acc: T[]) => {
    if (acc.length === size) {
      result.push([...acc]);
      return;
    }
    for (let i = start; i < input.length; i++) {
      acc.push(input[i]);
      combos(size, i + 1, acc);
      acc.pop();
    }
  };
  for (let size = 1; size <= input.length; size++) {
    combos(size, 0, []);
  }
  return result;
}

describe("utilities - powerset", () => {
  it("should generate empty result from empty input", () => {
    const result = getPowerSet([]);
    assert.sameDeepOrderedMembers(result, []);
  });

  it("should generate all combinations", () => {
    const result = getPowerSet(["a", "b", "c"]);
    const expectation = [
      ["a"],
      ["b"],
      ["c"],
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
      ["a", "b", "c"],
    ];
    assert.sameDeepOrderedMembers(result, expectation);
  });

  it("should apply maxResults limit", () => {
    const result = getPowerSet(["a", "b", "c"], { maxResults: 5 });
    const expectation = [["a"], ["b"], ["c"], ["a", "b"], ["a", "c"]];
    assert.sameDeepOrderedMembers(result, expectation);
  });

  it("should apply maxResults limit when it falls partway through a size group", () => {
    const result = getPowerSet(["a", "b", "c", "d", "e"], { maxResults: 8 });
    const expectation = [
      ["a"],
      ["b"],
      ["c"],
      ["d"],
      ["e"],
      ["a", "b"],
      ["a", "c"],
      ["a", "d"],
    ];
    assert.sameDeepOrderedMembers(result, expectation);
  });

  it("should not skip combinations for inputs with 4 or more items", () => {
    const result = getPowerSet(["a", "b", "c", "d"]);
    assert.lengthOf(result, 15);
    assert.deepInclude(result, ["b", "c", "d"]);
  });

  [0, 1, 2, 3, 4, 5, 6, 8].forEach((size) => {
    it(`should generate exactly 2^n - 1 combinations for n=${String(size)}`, () => {
      const input = Array.from({ length: size }, (_, index) => index);
      const result = getPowerSet(input);
      assert.lengthOf(result, 2 ** size - 1);
    });
  });

  [4, 5].forEach((size) => {
    it(`should match an independently computed reference order for n=${String(size)}`, () => {
      const input = Array.from({ length: size }, (_, index) => index);
      const result = getPowerSet(input);
      assert.sameDeepOrderedMembers(result, referencePowerSet(input));
    });
  });

  it("should not generate duplicate combinations", () => {
    const input = Array.from({ length: 6 }, (_, index) => index);
    const result = getPowerSet(input);
    const unique = new Set(result.map((item) => JSON.stringify(item)));
    assert.strictEqual(unique.size, result.length);
  });

  it("should stay lazy and not materialize the full power set when maxResults is small", () => {
    const input = Array.from({ length: 1000 }, (_, index) => index);
    const startTime = Date.now();
    const result = Array.from(
      powerSetGenerator(input, { maxResults: 50 }),
    );
    assert.lengthOf(result, 50);
    assert.isBelow(Date.now() - startTime, 1000);
  });
});
