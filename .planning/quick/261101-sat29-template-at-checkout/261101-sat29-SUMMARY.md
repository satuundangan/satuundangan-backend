# SAT-29: Checkout template attribution summary

## Delivered locally
- `Payment.templateDesignIdSnapshot` records the template selected when an invitation payment is created (paid or free).
- Paid/free template metrics group by the stored snapshot. Legacy rows fall back to the invitation's current template.
- Invitation created/published counts continue using the invitation's current template.

## Validation
- Backend `npm run build`: passed.
- `git diff --check`: passed.
- Tests were not run.

## Deployment
- Not pushed or deployed yet. Intended target is `development` only.
