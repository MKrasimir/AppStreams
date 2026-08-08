import ElementModel from "../ElementModel.js";
import PartnerForm from "../forms/PartnerForm.js";

// Shared by verifyPartnerDetails and verifyPartnerChanges - kept at module scope
// (matching antdSelectHelper.js's convention) so both reuse the same rules instead
// of each declaring their own copy.
const normalizeText = (value) => (value || "").trim().replace(/\s+/g, " ").toLowerCase();
const normalizePhone = (value) => (value || "").replace(/\s+/g, "");

export default class PartnersPage {
  constructor() {
    // Replace placeholder data-testid selector after DOM inspection.
    this.addButton = new ElementModel('.ant-btn');
    this.form = new PartnerForm();
  }

  openCreateForm() {
    this.addButton.click();
  }

  createPartner(partner) {
    this.openCreateForm();
    this.form.fill(partner);
    this.form.submit();
  }

  verifyLoaded() {
    // The page heading shares its bilingual text with the (hidden, collapsed-sidebar)
    // nav item, so scope by visibility rather than a CSS-module hash class or locale.
    cy.contains(":visible", /Partners|Партньори/i).should("be.visible");
  }

  verifyPartnerExists(name) {
    cy.contains(name).should("be.visible");
  }

  // Filters real rows by their Name-column text and asserts exactly one match -
  // never .first()/.eq()/nth-child(), since the table holds many existing Partners.
  getPartnerRow(name) {
    return cy
      .get("tr.ant-table-row")
      .filter((_, el) => Cypress.$(el).find(".testid-requestNumberColumn").text().includes(name))
      .should("have.length", 1);
  }

  // Row-scoped: the confirmed real DOM shows every row reuses the same
  // id="action-button", so this must never be queried outside a located row.
  getActionButton(name) {
    return this.getPartnerRow(name).find("#action-button");
  }

  openActionsMenu(name) {
    this.getActionButton(name).should("have.length", 1).and("be.visible").click();
  }

  openEditPartner(name) {
    this.openActionsMenu(name);

    cy.get("#edit-button").should("have.length", 1).and("be.visible").click();

    // No separate Edit-form model exists in this app - PartnerForm's own fields are
    // reused here as the open-signal, rather than guessing a new modal selector.
    this.form.fields.name.get().should("be.visible");
  }

  // Replaces the entire value of both fields (ElementModel.type() clears first) and
  // saves through the same generic PartnerForm submit() Create already uses.
  updatePartnerNameAndPhone(name, phone) {
    this.form.fields.name.type(name);
    this.form.fields.phone.type(phone);
    this.form.submit();
  }

  verifyPartnerDetails(partner) {
    this.getPartnerRow(partner.name).within(() => {
      cy.get(".testid-requestNumberColumn").should(($cell) => {
        expect(normalizeText($cell.text())).to.include(normalizeText(partner.name));
      });
      cy.get(".testid-carColumn").should(($cell) => {
        expect(normalizeText($cell.text())).to.include(normalizeText(partner.address));
      });
      cy.get(".testid-usersColumn").should(($cell) => {
        expect(normalizePhone($cell.text())).to.include(normalizePhone(partner.phone));
      });
      cy.get(".testid-pickUpDateColumn").should(($cell) => {
        expect(normalizeText($cell.text())).to.include(normalizeText(partner.contactPerson));
      });

      // Per-tag exact match, not a substring search over the whole cell's
      // concatenated text - the real markup has no separator between adjacent
      // service tags. Uses the bare `span` element, never the generated
      // .CxZJ6/.SB1Op classes seen in the real DOM.
      cy.get(".testid-serviceTypeColumn")
        .find("span")
        .then(($tags) => {
          const actualServices = $tags.map((_, el) => normalizeText(Cypress.$(el).text())).get();
          partner.services.forEach((service) => {
            expect(actualServices, `service "${service}" persisted in row`).to.include(normalizeText(service));
          });
        });

      cy.get(".testid-carServiceColumn").should(($cell) => {
        expect(normalizeText($cell.text())).to.include(normalizeText(partner.plan));
      });

      // Row-scoped lookup only - proves the action button resolves to exactly one
      // element inside this row (its id is duplicated across every row). Not clicked.
      cy.get("#action-button").should("have.length", 1).and("be.visible");
    });
  }

  // Focused UPDATE-only comparison: proves the real persisted cells changed away
  // from the pre-update values and landed on the post-update expected values - not
  // just that the two JS objects differ. verifyPartnerDetails covers the complete
  // post-update record separately; this never replaces it.
  verifyPartnerChanges(originalPartner, updatedPartner) {
    this.getPartnerRow(updatedPartner.name).within(() => {
      cy.get(".testid-requestNumberColumn").should(($cell) => {
        const persistedName = normalizeText($cell.text());
        expect(persistedName, "persisted name differs from pre-update name").to.not.equal(
          normalizeText(originalPartner.name)
        );
        expect(persistedName, "persisted name matches updated name").to.equal(
          normalizeText(updatedPartner.name)
        );
      });

      cy.get(".testid-usersColumn").should(($cell) => {
        const persistedPhone = normalizePhone($cell.text());
        expect(persistedPhone, "persisted phone differs from pre-update phone").to.not.equal(
          normalizePhone(originalPartner.phone)
        );
        expect(persistedPhone, "persisted phone matches updated phone").to.equal(
          normalizePhone(updatedPartner.phone)
        );
      });
    });
  }
}
