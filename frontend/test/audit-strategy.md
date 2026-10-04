# Frontend reliability audit tests

Artifact: shared decimal input parser. Criticality: HIGH (prices, quantities, financial inputs).

Gates: 0 OFF (parsing behavior); 1 ON (pure parsing); 2 OFF (no I/O);
3 OFF (helper has no UI); 4 OFF (no separately deployed consumer);
5 OFF (helper is not deployable); 6 ON (numeric round-trip invariant).

Selected types (rationale → type → size → framework → dependencies → gate):

- Locale and invalid-input partitions → unit → small → node:test → none → Gate 1.
- Deterministic numeric sample round-trip and normalization idempotency → property-based → small → node:test → none → Gate 6.

Rejected types: no boundary → integration; no UI → component/e2e;
no public API → contract; no deployment → smoke.
Deliberately skipped: helper has no UI and unit tests cover the parser → helper e2e (strategic skip).

Cases to cover:

- Fractional money retains its value across comma, dot and mixed locale formats.
- Grouped integer amounts retain historical behavior.
- Zero boundary: -1, 0, 1; fractional amount 0.01.
- Malformed grouping, incomplete values and trailing junk are rejected.
- Locale-format round-trip across positive and negative sampled amounts.

Additional verification: static scope analysis across frontend modules catches missing
runtime bindings even in populated-data branches skipped by initial render tests.
Reproduced `CurrencyOpsTool`'s undefined `branchId`, then verified its removal.
This is a medium filesystem test using the Babel parser/traverser already supplied by
the Vite React plugin. No production data or network access is required.
