import { assert } from "chai";
import {
  parseComment,
  parseCommentContent,
  parseFrontMatterContent,
  parseScenario,
} from "./scenario-utilities.js";

describe("Scenario Utilities", () => {
  let rootElement: Element;

  beforeEach(() => {
    rootElement = document.createElement("div");
  });

  afterEach(() => {
    rootElement.remove();
  });

  describe("parseCommentContent", () => {
    it("should parse non-matching content", () => {
      const content = "some content";
      const result = parseCommentContent(content);
      assert.deepEqual(result, null);
    });

    it("should parse identifier", () => {
      const content = "identifier: mock identifier";
      const result = parseCommentContent(content);
      assert.deepEqual(result, { identifier: "mock identifier" });
    });

    it("should parse expectation", () => {
      const content = "expect: mock expectation";
      const result = parseCommentContent(content);
      assert.deepEqual(result, { expectation: "mock expectation" });
    });

    it("should parse identifier and expectation", () => {
      const content = "expect: mockIdentifier; mock expectation";
      const result = parseCommentContent(content);
      assert.deepEqual(result, {
        identifier: "mockIdentifier",
        expectation: "mock expectation",
      });
    });

    it("should keep colons that are part of the expectation", () => {
      const result = parseCommentContent("expect: .aaa\\:bbb");
      assert.deepEqual(result, { expectation: ".aaa\\:bbb" });
    });

    it("should keep colons in an attribute value", () => {
      const result = parseCommentContent("expect: [href='http://example.com']");
      assert.deepEqual(result, {
        expectation: "[href='http://example.com']",
      });
    });

    it("should keep colons in a grouped expectation", () => {
      const result = parseCommentContent("expect: needle; .aaa\\:bbb");
      assert.deepEqual(result, {
        identifier: "needle",
        expectation: ".aaa\\:bbb",
      });
    });

    it("should not treat a semicolon inside a value as a group divider", () => {
      const result = parseCommentContent("expect: [data-aaa='bbb;ccc']");
      assert.deepEqual(result, {
        expectation: "[data-aaa='bbb;ccc']",
      });
    });

    it("should keep a JSON value intact", () => {
      const result = parseCommentContent('options: {"selectors": ["id"]}');
      assert.deepEqual(result, null);
    });

    it("should ignore a multiline note whose lines contain colons", () => {
      const result = parseCommentContent(
        "\n  NOTE: the chain is\n  :root -> HTML\n",
      );
      assert.deepEqual(result, null);
    });
  });

  describe("parseComment", () => {
    function generateComment(content: string): Comment {
      const comment = document.createComment(content);
      rootElement.appendChild(comment);
      return comment;
    }

    it("should parse non-matching comment", () => {
      const comment = generateComment("some content");
      const result = parseComment(comment);
      assert.deepEqual(result, null);
    });

    it("should parse identifier", () => {
      const comment = generateComment("identifier: mock identifier");
      const result = parseComment(comment);
      assert.deepEqual(result, {
        identifier: "mock identifier",
        element: comment.parentElement,
      });
    });

    it("should parse expectation", () => {
      const comment = generateComment("expect: mock expectation");
      const result = parseComment(comment);
      assert.deepEqual(result, {
        expectation: "mock expectation",
        element: comment.parentElement,
      });
    });

    it("should not include element if both identifier and expectation are present", () => {
      const comment = generateComment(
        "expect: mockIdentifier; mock expectation",
      );
      const result = parseComment(comment);
      assert.deepEqual(result, {
        identifier: "mockIdentifier",
        expectation: "mock expectation",
      });
    });
  });

  describe("parseFrontMatterContent", () => {
    it("should ignore a comment that is not front matter", () => {
      assert.equal(parseFrontMatterContent("expect: .aaa"), null);
    });

    it("should ignore a comment merely mentioning scenario", () => {
      assert.equal(parseFrontMatterContent("scenario stuff\ntitle: x"), null);
    });

    it("should parse all supported keys", () => {
      const result = parseFrontMatterContent(
        '\nscenario\ntitle: Mock title\ndescription: Mock description\ntags: aaa, bbb\noptions: {"includeTag": true}\n',
      );
      assert.deepEqual(result, {
        title: "Mock title",
        description: "Mock description",
        tags: ["aaa", "bbb"],
        options: { includeTag: true },
      });
    });

    it("should default missing keys", () => {
      const result = parseFrontMatterContent("scenario");
      assert.deepEqual(result, {
        title: null,
        description: null,
        tags: [],
        options: {},
      });
    });

    it("should keep a colon inside a description", () => {
      const result = parseFrontMatterContent(
        "scenario\ndescription: Two elements: one id",
      );
      assert.equal(result.description, "Two elements: one id");
    });

    it("should throw on invalid options JSON", () => {
      assert.throws(
        () => parseFrontMatterContent("scenario\noptions: {nope}"),
        /invalid JSON/,
      );
    });
  });

  describe("parseScenario", () => {
    it("should read front matter from the first comment", () => {
      rootElement.innerHTML = `
        <!--
          scenario
          title: Mock title
          options: {"includeTag": true}
        -->
        <div id="mockId"><!-- expect: #mockId --></div>
      `;
      const result = parseScenario(rootElement);
      assert.equal(result.metadata.title, "Mock title");
      assert.deepEqual(result.metadata.options, { includeTag: true });
      assert.lengthOf(result.expectations, 1);
    });

    it("should not read front matter from a later comment", () => {
      rootElement.innerHTML = `
        <div id="mockId"><!-- expect: #mockId --></div>
        <!--
          scenario
          title: Mock title
        -->
      `;
      const result = parseScenario(rootElement);
      assert.equal(result.metadata.title, null);
    });

    it("should return empty if there are no comments", () => {
      rootElement.innerHTML = "<div></div>";
      const result = parseScenario(rootElement);
      assert.deepEqual(result.needles, []);
      assert.deepEqual(result.expectations, []);
    });

    it("should return empty if there are no matching comments", () => {
      rootElement.innerHTML = "<div><!-- some comment --></div>";
      const result = parseScenario(rootElement);
      assert.deepEqual(result.needles, []);
      assert.deepEqual(result.expectations, []);
    });

    it("should associate an inline expectation with its element", () => {
      rootElement.innerHTML = `
        <div id="mockId"><!-- expect: #mockId --></div>
      `;
      const result = parseScenario(rootElement);
      assert.deepEqual(result.needles, [
        {
          id: "#0",
          elements: [rootElement.querySelector("#mockId")],
          root: null,
        },
      ]);
      assert.deepEqual(result.expectations, [
        { needleId: "#0", selector: "#mockId" },
      ]);
    });

    it("should keep a needle that has an identifier but no expectation", () => {
      rootElement.innerHTML = `
        <div id="mockId"><!-- identifier: mockElement --></div>
      `;
      const result = parseScenario(rootElement);
      assert.deepEqual(result.needles, [
        {
          id: "mockElement",
          elements: [rootElement.querySelector("#mockId")],
          root: null,
        },
      ]);
      assert.deepEqual(result.expectations, []);
    });

    it("should bind a group expectation to its identifier", () => {
      rootElement.innerHTML = `
        <div id="mockId"><!-- identifier: mockElement --></div>
        <!-- expect: mockElement; #mockId -->
      `;
      const result = parseScenario(rootElement);
      assert.deepEqual(result.needles, [
        {
          id: "mockElement",
          elements: [rootElement.querySelector("#mockId")],
          root: null,
        },
      ]);
      assert.deepEqual(result.expectations, [
        { needleId: "mockElement", selector: "#mockId" },
      ]);
    });

    it("should keep separate needles for separate inline expectations", () => {
      rootElement.innerHTML = `
        <div id="firstMockId"><!-- expect: #firstMockId --></div>
        <div id="secondMockId"><!-- expect: #secondMockId --></div>
      `;
      const result = parseScenario(rootElement);
      assert.deepEqual(result.needles, [
        {
          id: "#0",
          elements: [rootElement.querySelector("#firstMockId")],
          root: null,
        },
        {
          id: "#1",
          elements: [rootElement.querySelector("#secondMockId")],
          root: null,
        },
      ]);
      assert.deepEqual(result.expectations, [
        { needleId: "#0", selector: "#firstMockId" },
        { needleId: "#1", selector: "#secondMockId" },
      ]);
    });

    it("should not merge distinct elements sharing an expected selector", () => {
      rootElement.innerHTML = `
        <div class="mockClass"><!-- expect: .mockClass --></div>
        <div class="mockClass"><!-- expect: .mockClass --></div>
      `;
      const result = parseScenario(rootElement);
      const elements = rootElement.querySelectorAll(".mockClass");
      assert.deepEqual(result.needles, [
        { id: "#0", elements: [elements[0]], root: null },
        { id: "#1", elements: [elements[1]], root: null },
      ]);
    });

    it("should group multiple elements under one identifier", () => {
      rootElement.innerHTML = `
        <div class="mockClass"><!-- identifier: mockElement --></div>
        <div class="mockClass"><!-- identifier: mockElement --></div>
        <!-- expect: mockElement; .mockClass -->
      `;
      const result = parseScenario(rootElement);
      assert.deepEqual(result.needles, [
        {
          id: "mockElement",
          elements: [...rootElement.querySelectorAll(".mockClass")],
          root: null,
        },
      ]);
      assert.deepEqual(result.expectations, [
        { needleId: "mockElement", selector: ".mockClass" },
      ]);
    });

    it("should assign the nearest marked ancestor as the needle root", () => {
      rootElement.innerHTML = `
        <span></span>
        <div id="mockRoot"><!-- root -->
          <span><!-- expect: span --></span>
        </div>
      `;
      const result = parseScenario(rootElement);
      assert.equal(
        result.needles[0].root,
        rootElement.querySelector("#mockRoot"),
      );
    });

    it("should assign the innermost marked ancestor", () => {
      rootElement.innerHTML = `
        <div id="outer"><!-- root -->
          <div id="inner"><!-- root -->
            <span><!-- expect: span --></span>
          </div>
        </div>
      `;
      const result = parseScenario(rootElement);
      assert.equal(result.needles[0].root, rootElement.querySelector("#inner"));
    });

    it("should not treat the marked element itself as rooted", () => {
      rootElement.innerHTML = `
        <div id="mockRoot"><!-- root --><!-- expect: div --></div>
      `;
      const result = parseScenario(rootElement);
      assert.equal(result.needles[0].root, null);
    });

    it("should keep an expectation whose identifier was never applied", () => {
      rootElement.innerHTML = `<!-- expect: missing; .mockClass -->`;
      const result = parseScenario(rootElement);
      assert.deepEqual(result.needles, []);
      assert.deepEqual(result.expectations, [
        { needleId: "missing", selector: ".mockClass" },
      ]);
    });
  });
});
