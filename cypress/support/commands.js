Cypress.Commands.add("login", () => {
  const email = Cypress.env("TEST_EMAIL");
  const password = Cypress.env("TEST_PASSWORD");

  if (!email || !password) {
    throw new Error("Missing TEST_EMAIL/TEST_PASSWORD. See cypress.env.example.json.");
  }

  cy.session(
    [email],
    () => {
      cy.visit("/");
      cy.get('input[autocomplete="email"]').clear().type(email, { log: false });
      cy.get('input[type="password"]').clear().type(password, { log: false });
      cy.get('button[type="submit"]').click();
      cy.url().should("not.include", "login");
    },
    {
      validate() {
        cy.window().its("localStorage").invoke("getItem", "auth").should("exist");
      }
    }
  );
});
