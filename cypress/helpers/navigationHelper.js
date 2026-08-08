export function navigateToPartners() {
  // Keep navigation knowledge outside step definitions.
  // The menu label span (#partners-menu-item) is intentionally display:none in the
  // collapsed sidebar; its parent row is the real visible/clickable target.
  cy.get("#partners-menu-item").parent().click();
  cy.url().should("match", /partner/i);
}
