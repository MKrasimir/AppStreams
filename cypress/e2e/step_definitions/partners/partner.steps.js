import { Given, When, Then } from "@badeball/cypress-cucumber-preprocessor";
import PartnersPage from "../../../models/pages/PartnersPage.js";
import { navigateToPartners } from "../../../helpers/navigationHelper.js";
import { buildPartnerData, generateUniqueSuffix, generatePhoneNumber } from "../../../helpers/testDataHelper.js";

const partnersPage = new PartnersPage();
let partner;
let originalPartner;

Given("I am logged in to the administration platform", () => {
  cy.login();
  cy.visit("/");
});

Given("I open the Partners section", () => {
  navigateToPartners();
});

Then("I should land on the Partners page", () => {
  partnersPage.verifyLoaded();
});

When("I create a new Service Partner using valid required data", () => {
  cy.fixture("partners/partner-data").then(({ servicePartner }) => {
    partner = buildPartnerData(servicePartner);

    partnersPage.registerCreatePartnerRequest();
    partnersPage.createPartner(partner);
    partnersPage.waitForCreatePartnerRequest(partner);
  });
});

Then("the Partner should be created successfully", () => {
  // Validates persisted row data (name, address, phone, contact person, services,
  // plan) scoped to the exact created row - not just a toast or a page-wide match.
  partnersPage.verifyPartnerDetails(partner);
});

When("I update the created Partner", () => {
  // Snapshot the full pre-update state before `partner` is reassigned below - the
  // only copy of "what was actually persisted by CREATE" would otherwise be lost.
  originalPartner = { ...partner };

  const updatedName = `${originalPartner.namePrefix} ${generateUniqueSuffix()}`;
  const updatedPhone = generatePhoneNumber();

  partner = { ...partner, name: updatedName, phone: updatedPhone };

  // Prove the update test data genuinely changed before touching the UI at all.
  expect(partner.name, "updated name differs from the original").to.not.equal(originalPartner.name);
  expect(partner.phone, "updated phone differs from the original").to.not.equal(originalPartner.phone);

  // The row currently on screen still has the ORIGINAL name until Save - locate it
  // by originalPartner.name, never by the not-yet-saved partner.name.
  partnersPage.openEditPartner(originalPartner.name);

  partnersPage.registerUpdatePartnerRequest();
  partnersPage.updatePartnerNameAndPhone(partner.name, partner.phone);
  partnersPage.waitForUpdatePartnerRequest(partner);
});

Then("the Partner changes should be persisted", () => {
  // Revisit the list so the assertion proves persistence, not only local form state.
  navigateToPartners();

  // Proves the real persisted Name/Phone actually changed (old value gone, new value
  // present) before verifying the complete post-update record below.
  partnersPage.verifyPartnerChanges(originalPartner, partner);
  partnersPage.verifyPartnerDetails(partner);
});
