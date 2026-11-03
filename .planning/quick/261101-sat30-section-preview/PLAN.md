# SAT-30 ADM-045 section preview API

## Goal

Expose enough sample-template identity for the frontend to open a local seeded demo at a verified section anchor.

## Implementation

- Extend `listSections` sample preview metadata with the template slug and renderer `componentKey`.
- Keep the existing selection restricted to an enabled section on a published template.
- Verify with backend build and `git diff --check`; do not run tests unless requested.
- Deploy only through the development workflow; do not deploy production.
