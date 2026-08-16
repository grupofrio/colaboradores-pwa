# Expense selected-article render safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the render-time `article is not defined` crash from the Fase 0 Gastos form.

**Architecture:** Derive the selected catalogue item once in `AdminGastosForm` scope. Both JSX and `handleSubmit` consume that same value, so the visual controls and submission validation cannot use different article identities.

**Tech Stack:** React 18, Vite, Node built-in test runner.

---

### Task 1: Guard the selected article render path

**Files:**

- Modify: `src/modules/admin/forms/AdminGastosForm.jsx`
- Modify: `tests/expenseCaptureFormContract.test.mjs`

- [ ] **Step 1: Write the failing test**

Assert that the form declares a component-scoped `selectedArticle` from
`catalog` and `articleId`, uses it in both JSX and submit validation, and no
longer conditionally renders against an undeclared `article` identifier.

- [ ] **Step 2: Run the target test to verify it fails**

Run: `node --test tests/expenseCaptureFormContract.test.mjs`.

Expected: FAIL because `selectedArticle` is absent from the deployed source.

- [ ] **Step 3: Implement the minimal correction**

Declare `const selectedArticle = catalog.find((item) => item.product_id === Number(articleId))`
in component scope and replace the existing rendering and submission uses of
`article` with `selectedArticle`.

- [ ] **Step 4: Run target verification**

Run: `node --test tests/expenseCaptureFormContract.test.mjs`.

Expected: PASS.

- [ ] **Step 5: Run repository verification and commit**

Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.

Commit with `fix(gastos): share selected article across render and submit`.

