---
trigger: model_decision
description: "Design system for Aesthetic OS UI: SCSS/BEM, sp-* tokens, Neural Expressive, Material 3 tonal surfaces, motion, responsiveness, and accessibility. Read when styling or reviewing frontend visual behavior."
---
# Aesthetic OS — Design System

## 1. Product intent (in priority order)

1. **Usability and accessibility:** visible focus, legible text, semantic meaning, adequate touch targets, keyboard/screen-reader support, perceivable errors and feedback.
2. **Invisible Interface:** remove redundant chrome; progressively reveal advanced tools, but never hide essential functions or safety confirmations.
3. **Material 3 Expressive:** create hierarchy with solid tonal containers, semantic color, consistent spacing, corner radius, shadow and elevation.
4. **Neural Expressive:** motion and AI status communicate actual application state rather than decorative pseudo-intelligence.
5. **Performance:** smooth interactions, lean CSS, no unnecessary filter-heavy animation or layout thrashing.

## 2. Canonical architecture

- Edit tokens only in `src/assets/styles/abstract/_variables.scss`; shared Sass mixins live in `src/assets/styles/abstract/_mixins.scss`.
- Integrate the canonical tokens in the project's *existing* global SCSS entrypoint. Do not duplicate `:root` declarations across components.
- Component SCSS classes follow BEM (`.card`, `.card__header`, `.card--interactive`); React uses `className`, `aria-*`, and `data-*` to represent visual state.
- Never hardcode color, shadow or animation-duration values in component SCSS when a semantic token exists; introduce an appropriately named token centrally only when needed.
- Keep global styles for resets, base typography, tokens and shared primitives; place component selectors in component-level global `.scss` imports, avoiding overly broad selectors.
- Use `@use` with a path the Sass resolver actually supports. Do not assume `@/` works in Sass merely because it works for TypeScript/Vite.

## 3. Surface/typography/layout contracts

- Tonal hierarchy: `--sp-color-surface-container-lowest`, `-low`, default `-container`, `-high`, `-highest`. Use solid surfaces by default.
- Prefer semantic tokens for foreground/background; avoid glows, glassmorphism, neon saturation and shadows when they obscure content.
- Spacing tokens: `--sp-space-*`; corner radius `--sp-radius-*`; typography `--sp-font-*` and `--sp-line-height-*`; elevation `--sp-elevation-*` and `--sp-shadow-*`; stacking `--sp-z-*`.
- Use responsive layout with CSS Grid/Flexbox, content-driven wrapping and `clamp()` where appropriate. Verify narrow viewport, zoom, overflow and dynamic text expansion.
- Do not truncate critical content, labels, errors or controls merely to achieve an aesthetic layout.

## 4. Motion and UI state

- Use `--sp-motion-easing-neural` and `--sp-motion-duration-*` for transitions; prefer `opacity` and `transform` for frequent animations. Respect `prefers-reduced-motion: reduce`.
- Motion must be purposeful: loading can breathe subtly, disclosure should communicate spatial continuity, success/error feedback should be unmistakable without relying exclusively on color.
- For streaming UI, use bounded update cadence, stable keys and auto-scroll respecting user position; do not forcibly follow output when the user scrolls away.
- AI statuses must correspond to actual system state: `idle`, `loading`, `streaming`, `success`, `error`, `cancelled`. Do not infer or display numerical AI certainty without calibrated backend data.
- Use skeleton placeholders and progress indicators only when justified by actual pending operations; provide accessible text (`role="status"` / live regions where appropriate).

## 5. Accessibility acceptance criteria

- Target WCAG 2.2 AA where applicable: normal text contrast >= 4.5:1, large text >= 3:1, non-text interactive boundary/icon contrast >= 3:1.
- The original dark token `--sp-color-text-muted: #5C6275` had insufficient contrast as normal text. Canonical palette raises the muted foreground to `#808697`; review contexts on highest surfaces separately.
- Use `:focus-visible` outlines; don't remove focus indicators. Keyboard operation, label associations, meaningful names, error descriptions and logical tab order are mandatory.
- Avoid conveying state through color alone. Avoid motion that causes unnecessary vestibular discomfort. Honor OS reduced-motion preferences.
- Verify primary/hover/accent foreground color pairings individually: white text on some bright brand-hover tokens does **not** achieve AA for normal text. Use accessible foreground tokens per state.

## 6. Prohibitions

- No Tailwind, inline style prop, CSS Modules, CSS-in-JS, wildcard `!important`, arbitrary per-component HEX palettes or unverifiable UI assumptions.
- Do not remove confirmations for irreversible actions in pursuit of an "invisible" interface.
- Don't add animated UI before the loading/error/empty/success states are correct.

## 7. Design review checklist

- [ ] Uses the canonical tokens and BEM classes.
- [ ] Covers default, hover, focus-visible, active, disabled, loading, empty, error, success states when relevant.
- [ ] Keyboard, accessible names, contrast, motion reduction and responsive behavior reviewed.
- [ ] No unnecessary UI chrome, motion, unauthorized packages or new one-off colors.
