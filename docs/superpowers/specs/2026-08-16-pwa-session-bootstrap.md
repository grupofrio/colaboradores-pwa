# PWA session bootstrap

## Problem

Immediately after a successful mobile login, React schedules the session write to
`localStorage` in an effect. `TalentRhBootstrap` can call `/pwa-talento/me`
before that effect runs, so it sends an empty or stale credential and turns a
valid session into a false `401`/login redirect.

## Decision

1. Persist the normalized login session synchronously before publishing it to
   React state or navigating.
2. Make the initial Talent bootstrap use the in-memory session it received,
   rather than reading `localStorage` again.
3. Only a mobile employee token (`odoo_employee_token` or
   `gf_employee_token`) may authenticate a Talent request. The generic PWA
   `session_token` is not an employee-token fallback.

## Verification

Unit coverage proves that an explicit fresh session wins over stale storage and
that a generic session token is never emitted in the employee-token header.
Source-contract coverage proves the bootstrap receives `session` and login
persists it before `setSession(next)`.
