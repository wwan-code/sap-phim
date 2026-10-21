---
trigger: model_decision
description: "Node.js/Express backend work: route/controller/service/repository layering, request validation, API schemas, central error handling, security, structured logs, and tests."
---
# Express Backend Implementation Rules

## 1. Layer responsibilities

- **Routes:** endpoints, middleware composition, versioning and route-specific constraints.
- **Middleware:** authentication, authorization, rate limiting where required, parsing/validation at trust boundaries and centralized error translation.
- **Controller:** read validated request context, call service, translate documented service outcomes to HTTP responses. Avoid domain-heavy branches, DB queries and unexpected side effects.
- **Service/domain:** implement business rules, application invariants, transactional orchestration and explicit error semantics.
- **Repository/data access:** compose parameterized DB operations; handle persistence mechanics and database-specific exceptions behind an abstraction when appropriate.
- Keep frontend `*.service.ts` (API client) distinct from backend `*.service.ts` (business service) by package boundaries, not merely file naming.

## 2. Request validation and errors

- Perform syntax/schema validation before domain execution: `params`, `query`, `body`, file uploads and external event payloads. Prefer existing project validation libraries; do not assume Zod/Joi is installed.
- Differentiate input validation (HTTP boundary) from business invariant checks (service/domain). This improves error mapping and security.
- Pass errors to established centralized Express error middleware. For Express 4, ensure rejected promises reach `next`; for Express 5 follow the installed version's support for async handlers.
- Avoid ad hoc `res.status(500)` scattered in controllers; centrally map known domain errors and unknown failures to safe, consistent responses. Never leak stack traces to clients in production.
- Response shape should follow existing API contracts (for example `{ success, data }` only if already standardized); don't unilaterally reformat public endpoints.

## 3. Security and observability

- Authenticate and authorize **server-side** for every protected operation; prevent insecure direct object references and privilege escalation.
- Use parameterized SQL/ORM bindings; verify transaction integrity and concurrency/idempotency for operations that write shared state.
- Limit payload size, sanitize response exposure, handle CORS/security headers according to the deployment architecture, and add rate limiting for abuse-prone endpoints where appropriate.
- No secret, credential, access token or private payload in logs. Prefer existing structured logger with contextual tags/correlation IDs and appropriate log levels; remove temporary `console.log` instrumentation.
- Validate configuration at startup and keep user-visible errors free of internal server details.

## 4. Naming and documentation

- Use `kebab-case` for directories and basename segments: `auth.controller.ts`, `user-service.ts`, `auth-middleware.ts` are acceptable; follow one established repository pattern consistently.
- External imports first, then configured internal alias imports, then relative imports. Use a blank line between groups if formatter permits.
- Document public controller/service contracts, behavior-changing edge cases and non-obvious transaction semantics; avoid documentation comments that simply restate the function name.
- Do not move files without updating every reference and route registration.

## 5. Verification

- Verify validation failure, authentication denial, authorization denial, success path, missing data and internal error propagation.
- Add tests for business invariants in services and request/response/error mapping at the HTTP boundary; use integration tests where DB behavior matters.
- Run the repository's actual scripts for typecheck, lint, test and build; do not assume commands exist or report fabricated success.
