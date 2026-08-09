// Navigation metadata, not business/test data, so this stays out of fixtures. Relative
// paths only - baseUrl is resolved dynamically per targetEnv, so this map must never
// reference a hostname. Login is intentionally absent: cy.session() only re-runs its
// setup (and renders the Login UI) on a cache miss, so it can't be reliably verified here.
const pages = {
  Requests: {
    path: "/requests",
    marker: /^Requests$/i,
  },
  Partners: {
    path: "/partners",
    marker: /^Partners$/i,
    // The menu label span is intentionally display:none in the collapsed sidebar;
    // its parent row is the real visible/clickable target.
    menuSelector: "#partners-menu-item",
  },
};

function getPage(pageName) {
  const page = pages[pageName];
  if (!page) {
    throw new Error(`Unknown page "${pageName}". Valid pages: ${Object.keys(pages).join(", ")}.`);
  }
  return page;
}

// Action only - never asserts. verifyPage() owns verification, kept separate so
// each has exactly one responsibility.
export function navigateTo(pageName) {
  const page = getPage(pageName);

  if (!page.menuSelector) {
    throw new Error(`Page "${pageName}" does not define menu navigation.`);
  }

  cy.get(page.menuSelector).parent().click();
}

// Verifies both signals: the real route (relative pathname, environment-independent)
// and a visible page marker scoped to real header markup - never the generated
// .TdMxe class.
export function verifyPage(pageName) {
  const page = getPage(pageName);

  cy.location("pathname").should("eq", page.path);
  cy.contains("header span", page.marker).should("be.visible");
}
