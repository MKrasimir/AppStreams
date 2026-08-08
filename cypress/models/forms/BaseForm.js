export default class BaseForm {
  constructor({ fields, submitButton }) {
    this.fields = fields;
    this.submitButton = submitButton;
  }

  submit() {
    this.submitButton.click();
  }
}
