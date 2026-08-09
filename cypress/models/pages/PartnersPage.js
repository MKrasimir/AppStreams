import ElementModel from "../ElementModel.js";
import PartnerForm from "../forms/PartnerForm.js";

// Shared by verifyPartnerDetails and verifyPartnerChanges so both use the same rules.
const normalizeText = (value) => (value || "").trim().replace(/\s+/g, " ").toLowerCase();
const normalizePhone = (value) => (value || "").replace(/\s+/g, "");

// Shared by the create/update wait helpers - both assert identically, differing only
// in the action/wording reported on failure.
function assertPartnerRequestBody(interception, partner, action, valueDescriptor) {
  expect(interception.response, `${action} Partner request returned a response`).to.exist;
  expect(interception.response.statusCode, `${action} Partner request returned success`).to.equal(200);
  expect(interception.request.body.name, `${action} Partner request contains ${valueDescriptor} name`).to.equal(
    partner.name
  );
  expect(
    normalizePhone(interception.request.body.phone),
    `${action} Partner request contains ${valueDescriptor} phone`
  ).to.equal(normalizePhone(partner.phone));
}

// Row-scoped table selectors, centralized here (not ElementModel) since they only mean
// anything scoped to an already-located Partner row.
const selectors = {
  row: "tr.ant-table-row",
  columns: {
    name: ".testid-requestNumberColumn",
    address: ".testid-carColumn",
    phone: ".testid-usersColumn",
    contactPerson: ".testid-pickUpDateColumn",
    services: ".testid-serviceTypeColumn",
    plan: ".testid-carServiceColumn",
  },
  actionButton: "#action-button",
  editButton: "#edit-button",
};

export default class PartnersPage {
  constructor() {
    this.addButton = new ElementModel('[id="new-New partner-button"]');
    this.form = new PartnerForm();
  }

  openCreateForm() {
    this.addButton.click();
  }

  prepareNewPartner(partner) {
    this.openCreateForm();
    this.form.fill(partner);
  }

  submitForm() {
    this.form.submit();
  }

  registerCreatePartnerRequest() {
    cy.intercept("POST", "**/admin/partner").as("createPartner");
  }

  waitForCreatePartnerRequest(partner) {
    cy.wait("@createPartner").should((interception) => {
      assertPartnerRequestBody(interception, partner, "create", "the created");
    });
  }

  // Filters real rows by their Name-column text and asserts exactly one match -
  // never .first()/.eq()/nth-child(), since the table holds many existing Partners.
  getPartnerRow(name) {
    return cy
      .get(selectors.row)
      .filter((_, el) => Cypress.$(el).find(selectors.columns.name).text().includes(name))
      .should("have.length", 1);
  }

  // Row-scoped: the confirmed real DOM shows every row reuses the same
  // id="action-button", so this must never be queried outside a located row.
  getActionButton(name) {
    return this.getPartnerRow(name).find(selectors.actionButton);
  }

  openActionsMenu(name) {
    this.getActionButton(name).should("have.length", 1).and("be.visible").click();
  }

  openEditPartner(name) {
    this.openActionsMenu(name);

    cy.get(selectors.editButton).should("have.length", 1).and("be.visible").click();

    // No separate Edit-form model exists in this app - PartnerForm's own fields are
    // reused here as the open-signal, rather than guessing a new modal selector.
    this.form.fields.name.get().should("be.visible");
  }

  // Replaces the entire value of both fields (ElementModel.type() clears first). Does
  // not submit - callers trigger Save separately via submitForm().
  updatePartnerFields(name, phone) {
    this.form.updateFields({ name, phone });
  }

  registerUpdatePartnerRequest() {
    cy.intercept("PUT", "**/admin/partner/*").as("updatePartner");
  }

  waitForUpdatePartnerRequest(partner) {
    cy.wait("@updatePartner").should((interception) => {
      assertPartnerRequestBody(interception, partner, "update", "updated");
    });
  }

  verifyPartnerDetails(partner) {
    this.getPartnerRow(partner.name).within(() => {
      cy.get(selectors.columns.name).should(($cell) => {
        expect(normalizeText($cell.text())).to.include(normalizeText(partner.name));
      });
      cy.get(selectors.columns.address).should(($cell) => {
        expect(normalizeText($cell.text())).to.include(normalizeText(partner.address));
      });
      cy.get(selectors.columns.phone).should(($cell) => {
        expect(normalizePhone($cell.text())).to.include(normalizePhone(partner.phone));
      });
      cy.get(selectors.columns.contactPerson).should(($cell) => {
        expect(normalizeText($cell.text())).to.include(normalizeText(partner.contactPerson));
      });

      // Per-tag exact match, not a substring search over the cell's concatenated text -
      // the real markup has no separator between adjacent tags. Uses the bare `span`
      // element, never the generated .CxZJ6/.SB1Op classes seen in the real DOM.
      cy.get(selectors.columns.services)
        .find("span")
        .should(($tags) => {
          const actualServices = $tags.map((_, el) => normalizeText(Cypress.$(el).text())).get();
          partner.services.forEach((service) => {
            expect(actualServices, `service "${service}" persisted in row`).to.include(normalizeText(service));
          });
        });

      cy.get(selectors.columns.plan).should(($cell) => {
        expect(normalizeText($cell.text())).to.include(normalizeText(partner.plan));
      });

      // Row-scoped lookup only - proves the action button resolves to exactly one
      // element inside this row (its id is duplicated across every row). Not clicked.
      cy.get(selectors.actionButton).should("have.length", 1).and("be.visible");
    });
  }

  // Proves the persisted cells actually changed away from the pre-update values, not
  // just that the two JS objects differ - verifyPartnerDetails covers the full
  // post-update record separately.
  verifyPartnerChanges(originalPartner, updatedPartner) {
    this.getPartnerRow(updatedPartner.name).within(() => {
      cy.get(selectors.columns.name).should(($cell) => {
        const persistedName = normalizeText($cell.text());
        expect(persistedName, "persisted name differs from pre-update name").to.not.equal(
          normalizeText(originalPartner.name)
        );
        expect(persistedName, "persisted name matches updated name").to.equal(
          normalizeText(updatedPartner.name)
        );
      });

      cy.get(selectors.columns.phone).should(($cell) => {
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
