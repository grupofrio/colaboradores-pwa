# Expense selected-article render safety

## Goal

Restore the Gastos screen by preventing a render-time reference to an undefined
expense article, while keeping the Fase 0 product-driven capture contract.

## Root cause

The deployed `AdminGastosForm` finds the selected article only inside
`handleSubmit`. The JSX that decides whether to show quantity, operation, and
asset-kind fields references `article` during every render, where that local
does not exist. React therefore throws `ReferenceError: article is not defined`
before the user can create a spend.

## Design

Derive one `selectedArticle` value from `catalog` and `articleId` in the
component scope. The render uses it for conditional fields; submission uses
the same value for validation and the Fase 0 payload. Changing company,
warehouse, date, or the selected article continues to clear dependent values
as it does today.

## Verification

Add a source-contract regression test that requires the component-scoped
derived value and forbids a render-only undeclared `article` reference. Run the
targeted test, the whole Node test suite, lint, production build, and
`git diff --check`.

