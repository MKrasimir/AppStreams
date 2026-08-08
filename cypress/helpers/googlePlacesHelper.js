function normalize(value) {
  return (value || "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Google's .pac-item often has no literal whitespace between the primary
// (.pac-item-query) and secondary (trailing sibling) text in the DOM, even though
// they render with visual spacing via CSS - collect each piece separately and join
// with an explicit space rather than trusting raw .text() concatenation.
function describeSuggestion($item) {
  const parts = [];
  $item.contents().each((_, node) => {
    if (node.nodeType === 3) {
      const text = (node.textContent || "").trim();
      if (text) parts.push(text);
      return;
    }
    const $node = Cypress.$(node);
    if ($node.hasClass("pac-icon")) {
      return;
    }
    const text = $node.text().trim();
    if (text) parts.push(text);
  });
  return parts.join(" ");
}

// Google Places Autocomplete interaction - kept separate from antdSelectHelper.js
// since this is a different, third-party widget with its own DOM semantics
// (.pac-container/.pac-item), not an Ant Design Select.
export function selectAddressSuggestion(triggerSelector, address) {
  const target = normalize(address);

  cy.get(triggerSelector).should("be.visible").clear().type(address);

  cy.get(".pac-container")
    .should("be.visible")
    .find(".pac-item")
    .should("have.length.greaterThan", 0)
    .then(($items) => {
      const $matches = $items.filter((_, el) => normalize(describeSuggestion(Cypress.$(el))) === target);

      if ($matches.length !== 1) {
        const available = $items
          .map((_, el) => `  "${describeSuggestion(Cypress.$(el))}"`)
          .get()
          .join(",\n");
        throw new Error(
          `selectAddressSuggestion: expected exactly one suggestion matching "${address}", ` +
            `found ${$matches.length}. Available suggestions: [\n${available}\n]`
        );
      }

      cy.wrap($matches).should("be.visible").click();
    });

  cy.get(".pac-container").should("not.be.visible");

  // Intentionally an exact match, not normalized: real runtime evidence shows the
  // input's value after selection is exactly the fixture-formatted address.
  cy.get(triggerSelector).should("have.value", address);
}
