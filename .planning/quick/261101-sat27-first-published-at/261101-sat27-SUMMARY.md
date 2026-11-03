# SAT-27: First publication timestamps summary

## Delivered

- Added nullable `Invitation.publishedAt` for the first observed publication transition.
- Recorded the timestamp on owner publish, free activation, verified payment settlement, payment reconciliation, simulation success, and admin publish paths.
- Admin customer detail now shows one publication timeline event per known published invitation. Legacy rows with no timestamp stay explicitly unknown; timestamps are not inferred from `updatedAt` or payment settlement.
- User detail shows the invitation creation time and first publication time/unknown state.
- Wedding completion remains unknown because the system has no completion event.

## Validation

- Backend `npm run build`: passed.
- Frontend `CI=1 npm run build`: passed; existing large-chunk warning remains.
- `git diff --check`: passed for both repositories.
- Frontend Prettier check for `AdminUsers.vue`: passed.
- Tests were not run.

## Deployment

- Backend `cbed84d` and frontend `2ee3e30` were pushed to `development`.
- Backend development workflow #115 and frontend development workflow both completed successfully.
- Production branch and environment were not touched.
