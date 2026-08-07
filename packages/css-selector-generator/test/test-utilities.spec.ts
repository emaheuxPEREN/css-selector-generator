import { assert } from "chai";
import { parseTestHtml } from "./test-utilities.js";

describe("test utilities", () => {
  it("should parse single element", function () {
    const data = parseTestHtml(`<div><!-- identifier: needle --></div>`);
    assert.equal(data.needle("needle"), data.root.firstElementChild);
  });

  it("should parse group of elements", function () {
    const data = parseTestHtml(`
      <div><!-- identifier: needle --></div>
      <div><!-- identifier: needle --></div>
    `);
    assert.lengthOf(data.needles("needle"), 2);
  });

  it("should parse expected selectors", function () {
    const data = parseTestHtml(`
      <div><!-- identifier: needle --></div>
      <!-- expect: needle; div -->
    `);
    assert.equal(data.expectation("needle"), "div");
  });

  it("should throw for an identifier that was never applied", function () {
    const data = parseTestHtml(`<div></div>`);
    assert.throws(() => data.needle("missing"), /missing/);
  });
});
