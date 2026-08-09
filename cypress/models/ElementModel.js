export default class ElementModel {
  constructor(selector) {
    this.selector = selector;
  }

  get() {
    return cy.get(this.selector);
  }

  click() {
    return this.get().should("be.visible").and("not.be.disabled").click();
  }

  type(value, options = {}) {
    return this.get().should("be.visible").clear().type(value, options);
  }

  uploadFile(filePath) {
    // The file input is not actionable through the normal UI, so `force: true` is
    // required to select the fixture file against it directly.
    return this.get().should("exist").selectFile(filePath, { force: true });
  }
}
