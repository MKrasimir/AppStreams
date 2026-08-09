import { Before, Given, When, Then } from "@badeball/cypress-cucumber-preprocessor";
import PartnersPage from "../../../models/pages/PartnersPage.js";
import { navigateTo, verifyPage } from "../../../helpers/navigationHelper.js";
import { buildPartnerData, generateUniqueSuffix, generatePhoneNumber } from "../../../helpers/testDataHelper.js";

const partnersPage = new PartnersPage();
let partner;
let originalPartner;
let pendingPartnerAction;

// Explicit scenario isolation - reset before every Scenario, independent of step order.
Before(() => {
  partner = undefined;
  originalPartner = undefined;
  pendingPartnerAction = undefined;
});

// Real, current two-case dispatch: CREATE/UPDATE hit different verbs/URLs and different
// wait/assert helpers. Set explicitly by fillValid/update below, never inferred.
const partnerSubmitters = {
  create: () => {
    partnersPage.registerCreatePartnerRequest();
    partnersPage.submitForm();
    partnersPage.waitForCreatePartnerRequest(partner);
  },
  update: () => {
    partnersPage.registerUpdatePartnerRequest();
    partnersPage.submitForm();
    partnersPage.waitForUpdatePartnerRequest(partner);
  },
};

// The one domain this suite currently automates, behind the shape the five generic steps
// below expect. Adding a second domain later means adding one more entry here with the
// same shape - the generic steps and getDomain() don't change.
const domains = {
  Partner: {
    fillValid: () => {
      cy.fixture("partners/partner-data").then(({ servicePartner }) => {
        partner = buildPartnerData(servicePartner);

        partnersPage.prepareNewPartner(partner);
        pendingPartnerAction = "create";
      });
    },
    update: () => {
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
      partnersPage.updatePartnerFields(partner.name, partner.phone);
      pendingPartnerAction = "update";
    },
    submit: () => {
      const submitAction = partnerSubmitters[pendingPartnerAction];
      if (!submitAction) {
        throw new Error("No pending Partner action to submit - call a fill/update step first.");
      }
      submitAction();
    },
    verifyCreated: () => {
      // Validates persisted row data (name, address, phone, contact person, services,
      // plan) scoped to the exact created row - not just a toast or a page-wide match.
      partnersPage.verifyPartnerDetails(partner);
    },
    verifyPersisted: () => {
      // Revisit the list so the assertion proves persistence, not only local form state.
      navigateTo("Partners");

      // Proves the real persisted Name/Phone actually changed (old value gone, new value
      // present) before verifying the complete post-update record below.
      partnersPage.verifyPartnerChanges(originalPartner, partner);
      partnersPage.verifyPartnerDetails(partner);
    },
  },
};

function getDomain(domainName) {
  const domain = domains[domainName];

  if (!domain) {
    throw new Error(`Unknown domain "${domainName}". Valid domains: ${Object.keys(domains).join(", ")}.`);
  }

  return domain;
}

Given("I am logged in to the administration platform", () => {
  cy.login();
  cy.visit("/");
});

When("I open the {string} section", (pageName) => {
  navigateTo(pageName);
});

Then("I should be on the {string} page", (pageName) => {
  verifyPage(pageName);
});

When("I fill the {string} form with valid required data", (domainName) => {
  getDomain(domainName).fillValid();
});

When("I update the {string} form with new details", (domainName) => {
  getDomain(domainName).update();
});

When("I submit the {string} form", (domainName) => {
  getDomain(domainName).submit();
});

Then("the {string} should be created successfully", (domainName) => {
  getDomain(domainName).verifyCreated();
});

Then("the {string} changes should be persisted", (domainName) => {
  getDomain(domainName).verifyPersisted();
});
