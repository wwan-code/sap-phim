# The Aesthetic OS — Workspace Agent Rules

> Applies to this React + Node.js/Express workspace only. These are project-specific constraints, not a universal rule for unrelated repositories.

## Project contract

- **Product philosophy:** Build a context-aware, accessible, responsive application combining **Neural Expressive**, **Material 3 Expressive** and **Invisible Interface**.
- **Design language:** Solid tonal surface layers, intentional depth, clear semantic hierarchy, progressive disclosure, restrained animation, high legibility and reduced cognitive friction.
- **Default theme:** Obsidian Cinema / dark tonal design; do not redesign the palette or add a light theme without explicit requirement.
- **Styling:** Use global SCSS + BEM classes + canonical `--sp-*` CSS custom properties. **No Tailwind, CSS Modules, CSS-in-JS, React `style` prop or direct DOM `.style` mutation** for application UI. Use state classes and `data-*` attributes for visual states.
- **Maintain token fidelity:** `src/assets/styles/abstract/_variables.scss` is the single canonical token implementation. Reuse existing design tokens. New tokens must be semantic, documented and added centrally. Preserve intentional brand colors.
- **Existing repository wins:** Before enforcing a specified folder path or alias, inspect project structure and build config. Adapt imports safely. Avoid broad migrations merely to match examples.

## Agent task contract

1. Inspect impacted files, existing `package.json` scripts, imports, SCSS entrypoint and components before edits.
2. Apply only the relevant specialized rules in `.agents/rules/`; do not confuse frontend API services and backend domain services.
3. Explicitly address loading/empty/error/success/disabled states for asynchronous UI; avoid invented AI confidence scores.
4. Never sacrifice semantic HTML, accessible keyboard interaction or user feedback for animation or minimal chrome.
5. Verify requested work through available tests, typecheck, lint, build and browser inspection when tooling is available; communicate checks honestly.

## Layer ownership and naming

- **React presentation components:** rendering, accessible markup, event forwarding and motion presentation; no direct backend calls or complex business rules.
- **Frontend hooks/stores:** local/client state, effects and orchestration; frontend API services own transport and response adaptation.
- **Express controllers/middleware:** request boundary, authentication/authorization, lightweight schema validation, HTTP mapping and delegation.
- **Backend services/domain:** business rules, orchestration, transactions and invariants; repositories/data access handle persistence.
- **Filenames:** frontend React component files `PascalCase.tsx`/`.jsx`; frontend hooks, services, stores, utilities, styles use `kebab-case` basename (role suffixes such as `auth.service.ts` accepted). Backend file/directory basename segments use `kebab-case`, with optional dotted role suffixes.

## Required reading for matching tasks

- UI and tokens: `.agents/rules/10-design-system.md`
- React UI, hooks or frontend services: `.agents/rules/20-react-frontend.md`
- Express API and backend data flow: `.agents/rules/30-express-backend.md`
- Cross-layer delivery and verification: `.agents/rules/40-quality-gates.md`

## Definition of done

A task is done only when the requested behavior is implemented, affected paths/imports are consistent, no unrelated destructive edits occur, the most relevant available validation has been attempted and results (including failures or skipped checks) are disclosed.
