export function generateUniqueSuffix() {
  return `${Date.now()}-${Cypress._.random(1000, 9999)}`;
}

// Same "+359 NNN NNN NNN" grouping as the fixture's phone value - only the digits
// are randomized, to stay compatible with whatever format the form/backend expects.
export function generatePhoneNumber() {
  const group = () => Cypress._.random(100, 999);
  return `+359 ${group()} ${group()} ${group()}`;
}

const REQUIRED_PARTNER_FIELDS = [
  "name",
  "type",
  "services",
  "plan",
  "address",
  "phone",
  "contactPerson",
  "description",
  "logo"
];

// Fail fast at data-construction time with a clear message, instead of letting a
// missing/renamed fixture field surface later as an opaque UI-layer error (e.g.
// "Cannot read properties of undefined").
function validatePartnerData(partner) {
  REQUIRED_PARTNER_FIELDS.forEach((field) => {
    const value = partner[field];
    const isMissing = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (isMissing) {
      throw new Error(`Partner test data: \`${field}\` is required`);
    }
  });
}

export function buildPartnerData(template) {
  const uniqueSuffix = generateUniqueSuffix();
  const name = `${template.namePrefix} ${uniqueSuffix}`;

  const partner = {
    ...template,
    name,
    contactPerson: `${template.contactPerson} ${uniqueSuffix}`,
    description: `${template.description} ${uniqueSuffix}`
  };

  validatePartnerData(partner);

  return partner;
}
