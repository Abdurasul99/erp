test_strategy:
  artifact: "src/store/Storefront.jsx, StoreIntro.jsx, and storeIntro.mjs"
  rationale: "The storefront intro is a user-visible first-load state transition that must remain skippable, motion-safe, and compatible with the catalog purchase path."
  criticality: "MEDIUM-HIGH"

  selected_types:
    - rationale: "First-session visibility contains deterministic storage-state logic; EP covers missing, completed, and unavailable storage states."
      type: "unit"
      size: "small"
      framework: "node:test"
      dependencies: []
      gate: "Gate 1"
    - rationale: "The intro and hero are user-facing UI on the store's primary entry path; browser checks cover timing, skip behavior, reduced motion, and responsive layout."
      type: "e2e"
      size: "large"
      framework: "Playwright"
      dependencies: ["local Vite preview server", "Chromium"]
      gate: "Gate 3"

  rejected_types:
    - reason: "The new intro state helper is pure and Framer Motion is exercised in the real browser; no additional external boundary is introduced, so Gate 2 is OFF."
      type: "integration"
    - reason: "The intro component's meaningful behavior is timeline- and viewport-dependent; a browser e2e has higher fidelity than a synthetic DOM component harness."
      type: "component"
    - reason: "The web client and API deploy together, so consumer-driven contract testing has low ROI."
      type: "contract"
    - reason: "Deployment validation is handled by Vercel's build result; this change does not add a stable test account or post-deploy probe contract."
      type: "smoke"
    - reason: "Intro visibility has a small finite state domain; EP covers it and the no-property-based-on-small-domains heuristic applies."
      type: "property-based"

  deliberately_skipped:
    - why: "The repository has no approved visual-regression baseline service; screenshots are reviewed manually in Chromium instead."
      what: "Pixel-diff regression across every supported browser"
    - why: "The primary audience uses evergreen browsers and the motion library supports them; Chromium desktop and mobile cover the current delivery risk."
      what: "Legacy and full cross-browser animation matrix"

## Test Cases to Cover

### AC-1: The antiquities intro appears only on the first load of a session
- [unit] missing completion state requests the intro [EP: first visit]
- [unit] completed state skips the intro [EP: returning visit]
- [unit] unavailable storage falls back to showing the intro [EP: restricted browser]
- [e2e] first visit renders Uzbek artifact imagery with a visible skip control
- [e2e] skip closes the intro and reveals the hero CTA

### AC-2: The intro presents the ART * Store identity with deliberate motion
- [e2e] the intro exposes the ART Store brand as an accessible heading
- [e2e] reduced-motion mode exits without a long animation

### AC-3: The hero is led by Uzbek antiquities photography
- [e2e] the hero loads the local Uzbek antiquities image
- [e2e] the hero brand is visually larger than the header brand

### AC-4: Existing commerce remains usable after the intro
- [e2e] selecting a category changes the visible collection after intro completion
- [e2e] adding a work opens the cart with the updated quantity
- [e2e] the mobile viewport renders without horizontal overflow
