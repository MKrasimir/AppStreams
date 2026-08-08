function normalize(value) {
  return (value || "").trim().toLowerCase();
}

function isMeaningfulLabel(label) {
  return typeof label === "string" && label.trim().length > 0 && label.trim() !== "[object Object]";
}

// Visible text is the primary source of truth for an option's value. The `label`
// attribute is only trusted as a fallback when it's a real string - some options on
// this app render label="[object Object]" (a stringified object, not a real label).
function describeOption($el) {
  const text = ($el.text() || "").trim();
  if (text) return text;
  const label = $el.attr("label");
  return isMeaningfulLabel(label) ? label.trim() : "";
}

function optionMatchesTargets($el, targets) {
  const text = normalize($el.text());
  const label = $el.attr("label");
  const normalizedLabel = isMeaningfulLabel(label) ? normalize(label) : null;
  return targets.includes(text) || (normalizedLabel !== null && targets.includes(normalizedLabel));
}

// jQuery's :visible only checks display/dimensions/detachment - it does NOT detect an
// element being covered by another element on top of it (a virtualized/recycled row
// positioned or overlaid oddly), which is a distinct, real failure mode Cypress's own
// actionability check catches via a center-point hit-test. Replicate that specific
// check here so a textual match that isn't actually clickable is never treated as
// usable, without weakening the real (later) Cypress "be.visible" assertion at all.
function isActionable($el) {
  if (!$el.is(":visible")) {
    return false;
  }

  const el = $el[0];
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const topElement = el.ownerDocument.elementFromPoint(centerX, centerY);

  return Boolean(topElement) && (topElement === el || el.contains(topElement) || topElement.contains(el));
}

// An option only counts as a currently-usable match if it both matches the requested
// value AND is actually actionable right now - a matching but hidden/covered/stale
// virtualized node must never short-circuit the search fallback.
function filterVisibleMatches($options, targets) {
  return $options.filter((_, el) => {
    const $el = Cypress.$(el);
    return optionMatchesTargets($el, targets) && isActionable($el);
  });
}

// AntD's search input is frequently already empty (auto-cleared by the widget itself
// after a multi-select pick, or simply never typed into for an immediate match).
// Calling .clear() on an ALREADY-EMPTY multi-select search input sends
// keyboard-clearing keystrokes this widget interprets as "backspace on an empty
// field", which removes the most recently selected tag. This is the single, shared
// safe-clear used everywhere the helper might touch the search input - never a
// bare .clear() anywhere else in this file.
function clearSearchIfNeeded(triggerSelector) {
  cy.get(triggerSelector)
    .invoke("val")
    .then((value) => {
      if (String(value ?? "").length > 0) {
        cy.get(triggerSelector).clear();
      }
    });
}

// Scoped to the real, confirmed AntD structural tag class, matched exactly after
// normalization - never a broad "container contains this text somewhere" check.
function assertOverflowTagExists(triggerSelector, value) {
  const targetText = normalize(value);
  return cy
    .get(triggerSelector)
    .closest(".ant-select")
    .find(".ant-select-selection-overflow-item")
    .filter((_, el) => normalize(Cypress.$(el).text()).includes(targetText))
    .should("have.length", 1);
}

function snapshotOf($options) {
  return $options
    .map((_, el) => describeOption(Cypress.$(el)))
    .get()
    .join("|");
}

function throwNoUniqueMatch(expectedVariants, matchCount, $options) {
  const items = $options
    .map((_, el) => `  "${describeOption(Cypress.$(el))}"`)
    .get()
    .join(",\n");
  throw new Error(
    `selectAntdOption: expected exactly one option matching [${expectedVariants.join(", ")}], ` +
      `found ${matchCount}. Available options: [\n${items}\n]`
  );
}

// Generic AntD Select interaction, reusable for any combobox field (Type, Services,
// Subscription plan, ...): open it, scope strictly to its own option panel via the
// trigger's ARIA relationship, and click the single option matching an expected value.
// Handles both plain selects (option already rendered) and virtualized, searchable
// selects where the full option set only exists in the DOM after typing a search term,
// and both single-select (dropdown auto-closes on pick) and multi-select (picked option
// becomes a tag, dropdown stays open and must be explicitly closed) controls - never a
// constructed label selector, never fixed scrolling, never a blind index.
export function selectAntdOption(triggerSelector, expectedVariants, { multiple = false } = {}) {
  const targets = expectedVariants.map(normalize);

  // 1. Open the specific combobox via its visible container - the search <input> is a
  // valid, field-specific anchor even where Ant Design renders it invisibly (e.g.
  // opacity: 0 on multi-select fields). Scoped from this unique field input, never a
  // global ".ant-select" search.
  cy.get(triggerSelector).should("exist").closest(".ant-select").should("be.visible").click();

  // 2. Resolve this field's own option panel via its ARIA relationship (aria-controls
  // -> that listbox id -> its parent, which also holds the real visible rows as a
  // sibling branch). This can never match a different Select's options.
  cy.get(triggerSelector)
    .invoke("attr", "aria-controls")
    .then((listboxId) => {
      const panelOptions = () => cy.get(`[id="${listboxId}"]`).parent().find(".ant-select-item-option");

      // finishSelection takes the matched option's TEXT/LABEL (plain strings extracted
      // once we know which option is the match) rather than a captured jQuery/DOM
      // reference. It then re-queries the live panel fresh, right here, as part of a
      // single Cypress-retried chain - never clicking a reference captured earlier
      // (e.g. before typing a search term or across a virtualized re-render). Declared
      // in this scope (not selectAntdOption's top level) because it needs panelOptions,
      // which only exists here once aria-controls has resolved to a listboxId.
      const finishSelection = (matchedText, matchedLabel, matchPath) => {
        const targetText = normalize(matchedText);
        const diagnosticContext =
          `[selectAntdOption diagnostics] triggerSelector=${JSON.stringify(triggerSelector)} ` +
          `multiple=${multiple} requested=${JSON.stringify(expectedVariants)} ` +
          `normalizedRequested=${JSON.stringify(targets)} matchPath=${matchPath} ` +
          `matchedText=${JSON.stringify(matchedText)} matchedLabel=${JSON.stringify(matchedLabel)}`;

        // Fresh, retried query: re-runs panelOptions() and re-filters on every retry
        // attempt until exactly one currently-actionable option has this exact text,
        // then clicks that live element - not a snapshot from before this chain started.
        panelOptions()
          .filter((_, el) => {
            const $el = Cypress.$(el);
            return normalize(describeOption($el)) === targetText && isActionable($el);
          })
          .should(($el) => {
            expect($el, diagnosticContext).to.have.length(1);
            expect($el, diagnosticContext).to.be.visible;
          })
          .click();

        if (!multiple) {
          return;
        }

        // Multi-select: the picked option becomes a removable chip/tag and the dropdown
        // stays open for further picks.
        // 1/2. Tag must exist right after the click, before any cleanup.
        assertOverflowTagExists(triggerSelector, matchedText);

        // 3/4/5. Shared safe-clear - never a bare .clear() here.
        clearSearchIfNeeded(triggerSelector);
        // Verify the (possible) clear step itself didn't remove the tag, isolated from Escape.
        assertOverflowTagExists(triggerSelector, matchedText);

        // 6. Close only after the tag is confirmed to still exist.
        cy.get(triggerSelector).type("{esc}");
        cy.get(triggerSelector).should("have.attr", "aria-expanded", "false");

        // 7. Regression guard: the tag must still exist after cleanup/close, isolated
        // from the clear step above - catches either mechanism dropping the tag.
        assertOverflowTagExists(triggerSelector, matchedText);
      };

      // 5. Not rendered yet (virtualized list) - use the field's own search input to
      // try each localized variant as a search term until the (async) list settles on
      // exactly one match. Cypress's .should() retry is what "waits for the update" -
      // no arbitrary cy.wait(), no scrolling, no increased timeouts.
      const trySearchVariant = (variantIndex, previousSnapshot) => {
        if (variantIndex >= expectedVariants.length) {
          panelOptions().then(($options) => throwNoUniqueMatch(expectedVariants, 0, $options));
          return;
        }

        clearSearchIfNeeded(triggerSelector);
        cy.get(triggerSelector).type(expectedVariants[variantIndex]);

        panelOptions()
          .should(($options) => {
            expect(snapshotOf($options), "option list re-rendered after search").not.to.equal(previousSnapshot);
          })
          .then(($options) => {
            // Re-queried fresh from the live DOM above, after the search re-render -
            // never a reference captured before typing. Only actionable matches count.
            const $visibleMatches = filterVisibleMatches($options, targets);

            if ($visibleMatches.length === 1) {
              finishSelection(describeOption($visibleMatches), $visibleMatches.attr("label") || null, "search");
              return;
            }

            if ($visibleMatches.length > 1) {
              throwNoUniqueMatch(expectedVariants, $visibleMatches.length, $options);
              return;
            }

            trySearchVariant(variantIndex + 1, snapshotOf($options));
          });
      };

      // 3. Inspect the currently rendered options first - covers plain, unvirtualized
      // selects (e.g. Type) without ever touching the search input.
      panelOptions().then(($rendered) => {
        // A matching-but-hidden/covered node (e.g. a stale virtualized row) must not
        // count as usable here, or it would incorrectly skip the search fallback.
        const $visibleImmediate = filterVisibleMatches($rendered, targets);

        // 4. Already rendered, matching, and actually actionable - click it directly.
        if ($visibleImmediate.length === 1) {
          finishSelection(describeOption($visibleImmediate), $visibleImmediate.attr("label") || null, "immediate");
          return;
        }

        if ($visibleImmediate.length > 1) {
          throwNoUniqueMatch(expectedVariants, $visibleImmediate.length, $rendered);
          return;
        }

        trySearchVariant(0, snapshotOf($rendered));
      });
    });
}

// Dedicated multi-select lifecycle for a field like Services - a genuinely different
// interaction from selectAntdOption's single-select lifecycle, not several single
// selections stitched together. Opens the control ONCE, picks every requested value
// within that same open dropdown session (reusing the still-open search input,
// never reopening/closing between values), then closes ONCE at the end.
export function selectAntdOptions(triggerSelector, values) {
  // Open once for the whole session.
  cy.get(triggerSelector).should("exist").closest(".ant-select").should("be.visible").click();
  cy.get(triggerSelector).should("have.attr", "aria-expanded", "true");

  cy.get(triggerSelector)
    .invoke("attr", "aria-controls")
    .then((listboxId) => {
      const panelOptions = () => cy.get(`[id="${listboxId}"]`).parent().find(".ant-select-item-option");

      const selectOneValue = (value) => {
        const targetText = normalize(value);
        const isMatch = (_, el) => {
          const $el = Cypress.$(el);
          return normalize(describeOption($el)) === targetText && isActionable($el);
        };

        // Search only if this value isn't already visible in the (virtualized) list -
        // reuses the still-open search input, never reopening the control.
        panelOptions().then(($rendered) => {
          const alreadyVisible = $rendered.filter(isMatch).length >= 1;

          if (!alreadyVisible) {
            const previousSnapshot = snapshotOf($rendered);

            clearSearchIfNeeded(triggerSelector);
            cy.get(triggerSelector).type(value);

            panelOptions().should(($options) => {
              expect(snapshotOf($options), "option list re-rendered after search").not.to.equal(previousSnapshot);
            });
          }
        });

        // Fresh, retried query regardless of the path above - re-runs panelOptions()
        // and re-filters on every retry attempt; never a jQuery/DOM reference
        // captured before the search/re-render.
        panelOptions().filter(isMatch).should("have.length", 1).click();

        // The requested service must exist as an exact tag right after its click.
        assertOverflowTagExists(triggerSelector, value);
      };

      values.forEach((value) => selectOneValue(value));

      // Close once, only after every requested value has been selected.
      cy.get(triggerSelector).type("{esc}");
      cy.get(triggerSelector).should("have.attr", "aria-expanded", "false");

      // Final verification: every requested value exists as a real selected tag
      // (.ant-select-selection-overflow-item), not merely as text somewhere in the control.
      values.forEach((value) => assertOverflowTagExists(triggerSelector, value));
    });
}
