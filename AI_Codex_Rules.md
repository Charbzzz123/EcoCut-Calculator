# Codex Rules – Angular 21 Codex Project

> **How to use this file**
>
> - When working with this repo using Codex / ChatGPT, paste this entire section (or at least from this heading down) as the **first message** in the chat.
> - Tell the AI: **“These are the project rules. Follow them strictly in all code you write or modify.”**

---

## 0. Project Context

- Framework: **Angular 21** (Angular CLI 21.0.2)
- Language: **TypeScript** (strict mode)
- Runtime: **Node.js 22.13.1**
- Package manager: **npm 11.2.0**
- Target: **Enterprise-style, scalable, testable Angular app**
- Architecture principles:
  - **Feature-based / domain-based** structure (`core`, `features`, `shared`)
  - **Facade pattern per feature** (components ⟷ facade ⟷ services / state)
  - Strict **separation of responsibilities**
  - High **lint quality** and **test coverage**

When you (Codex / ChatGPT) generate or modify code, you **MUST** follow the rules below.

---

## 1. Global Architecture Rules

### 1.1 App folder layout

The `src/app` folder MUST follow this structure:

```text
src/
  app/
    core/        # Singletons & cross-cutting concerns (one import at app root)
    features/    # Business & app features (main place for real logic)
      <feature-name>/
        components/
        services/
        facades/
        models/
        store/           # optional: NgRx / signals / other state
        <feature>.routes.ts  # or <feature>.module.ts if using modules
    shared/      # Reusable UI pieces, pipes, directives, utilities
```
