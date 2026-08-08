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
    // No <input type="file"> exists anywhere in this app's DOM for this widget
    // (confirmed via live DevTools search) - it creates one dynamically in JS without
    // attaching it to the document, so selectFile() has no file input to target, with
    // or without force. { action: "drag-drop" } instead simulates dropping the file
    // onto this element, which Cypress supports against any element and which this
    // kind of upload widget listens for as click-to-browse's equivalent.
    return this.get().should("exist").selectFile(filePath, { force: true });
  }
}
