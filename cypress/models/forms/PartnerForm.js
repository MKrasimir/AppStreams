import BaseForm from "./BaseForm.js";
import ElementModel from "../ElementModel.js";
import { selectAntdOption, selectAntdOptions } from "../../helpers/antdSelectHelper.js";
import { selectAddressSuggestion } from "../../helpers/googlePlacesHelper.js";

export default class PartnerForm extends BaseForm {
  constructor() {
    super({
      fields: {
        name: new ElementModel('#name-field'),
        type: new ElementModel("#partner-type-field"),
        services: new ElementModel("#service-types-field"),
        plan: new ElementModel("#subscription-tier-field"),
        address: new ElementModel("#address-field"),
        phone: new ElementModel('[name="phone"]'),
        contactPerson: new ElementModel("#contact-person-field"),
        description: new ElementModel("#description-field"),
        logo: new ElementModel('input[type="file"][name="file-upload"]')
      },
      submitButton: new ElementModel('#save-button')
    });
  }

  fill({ name, type, services, plan, address, phone, contactPerson, description, logo }) {
    this.fields.name.type(name);

    this.selectType(type);
    this.selectServices(services);
    this.selectPlan(plan);

    this.selectAddress(address);
    this.fields.phone.type(phone);
    this.fields.contactPerson.type(contactPerson);
    this.fields.description.type(description);

    this.fields.logo.uploadFile(logo);
    this.confirmPhotoUpload();
  }

  selectType(type) {
    selectAntdOption(this.fields.type.selector, type.split(" / ").map((part) => part.trim()));
  }

  selectServices(services) {
    selectAntdOptions(this.fields.services.selector, services);
  }

  selectPlan(plan) {
    selectAntdOption(this.fields.plan.selector, plan.split(" / ").map((part) => part.trim()));
  }

  selectAddress(address) {
    selectAddressSuggestion(this.fields.address.selector, address);
  }

  confirmPhotoUpload() {
    // selectFile() only attaches the raw file - the app then opens a separate "Edit
    // photo" crop/confirm modal, and the image isn't applied until its own Save is
    // clicked. That Save button carries no id (unlike the Partner form's own
    // #save-button), so it's only reachable by scoping into this specific, visible
    // modal via its heading text - never a bare button/id lookup that could otherwise
    // collide with the Partner form's main Save button.
    const modal = () => cy.contains(".ant-modal-content", "Edit photo");

    modal().should("be.visible");

    modal().within(() => {
      cy.contains("button", "Save").should("be.visible").and("not.be.disabled").click();
    });

    modal().should("not.exist");

    // The placeholder upload icon is replaced by the actual image once applied.
    cy.get('img[src^="data:image"]').should("exist");
  }
}
