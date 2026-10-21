---
trigger: model_decision
description: "React/TypeScript frontend implementation: component separation, hooks/stores, transport services, BEM/SCSS, accessibility, state management, imports, JSDoc, and tests."
---
# React Frontend Implementation Rules

## 1. Layer separation

- **Presentation:** components accept typed props and event callbacks, render semantic JSX, apply BEM classes, handle accessible interaction and presentation-only microstate.
- **Hooks/stores:** own screen state, async orchestration, caching decisions, derived client state and lifecycle cleanup.
- **Frontend services:** encapsulate HTTP/WebSocket transport, request/response parsing and API error normalization. They must not import Express controllers or DB internals.
- **Domain utilities:** keep pure transformations framework-independent; favor named, testable functions.
- Not every component must be "dumb": local interaction state (e.g., open/closed disclosure, focus management) belongs in a UI component when it is genuinely presentational. Business workflows and API calls belong elsewhere.

## 2. Type safety and API boundaries

- Follow repository's actual TypeScript/JS choice; use TypeScript when already established. Avoid `any`, unchecked casts and silently swallowed errors.
- At external boundaries, validate/normalize server payloads where the codebase's existing library/convention supports it; make loading, error and cancellation explicit.
- Never trust frontend permission state as a substitute for server-side authorization.
- Use stable keys, remove event listeners, cancel stale async requests and prevent updates after stale navigations.
- For streaming, use abort/cancel handling, incremental state updates, backpressure where supported and non-blocking rendering.

## 3. Naming, imports and documentation

- Component module: `ChatWindow.tsx`; hook: `use-chat.ts`; API service: `chat.service.ts`; component style: `chat-window.scss`.
- Import order separated by blank lines: (1) external libraries (2) alias-based internal modules if alias exists (3) relative code and styles. Prefer repo formatter/import sorter when configured.
- Follow type-only import conventions in the project's TS config. On rename/move, update all imports, tests, barrel exports, routes and documentation impacted by the change.
- Add a concise file header on newly created source files when the repository already uses such headers. Add TSDoc/JSDoc for public functions, exported hooks/components with non-obvious contracts; do not force JSDoc headers into JSON, lockfiles, generated code or every SCSS declaration.

## 4. Presentation and styling

- No Tailwind, CSS Modules, CSS-in-JS, React `style={{ ... }}` or direct DOM styling. Express visual variants as `className` modifiers or `data-state` attributes and corresponding `.scss` selectors.
- Preserve design tokens defined by the canonical `_variables.scss`. Do not embed uncontrolled color or shadow values in components.
- Form controls must have labels, error messages, keyboard/focus behavior and clear disabled/pending states. Prefer native HTML semantics.
- For animation, use CSS first; a motion library is acceptable only if the existing project uses it or justified dependency approval exists, and it must still obey styling and reduced-motion policy.

## 5. Implementation contract

1. Examine existing components/hooks/services that implement similar behavior; reuse established design patterns.
2. Specify props/interfaces and state transitions before editing cross-component code.
3. Keep business conditions in hooks/services; leave the UI focused on presentation and accessible events.
4. Add targeted unit/component tests for behavior and error paths, when test infrastructure exists.
5. Run relevant `lint`, `typecheck`, `test` and `build` scripts available in `package.json`; report truthful results.

## 6. Anti-patterns

- Calling `fetch` or `axios` inside reusable presentation components.
- Huge hooks mixing API, layout, navigation, persistent storage and domain logic without boundaries.
- Fabricated AI confidence values, perpetual spinners, non-dismissable error overlays or hidden keyboard focus.
- Inserting a new state library or animation package without checking whether existing dependencies already solve the problem.
