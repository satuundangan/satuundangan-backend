# SAT-30: Stable category filters summary

## Delivered locally
- Category names are normalized with Unicode NFKC, trimmed whitespace, and collapsed internal spaces.
- Duplicate category names are rejected across case/spacing variants and aliases.
- Renames retain previous names as aliases. Admin template/invitation filters can resolve IDs and legacy names.
- Category drilldown links use immutable IDs; old name-based links remain usable after rename.

## Validation
- Backend `npm run build`: passed.
- Frontend `CI=1 npm run build`: passed (existing large-chunk warning).
- `git diff --check` passed in both repositories.
- Tests were not run.

## Deployment
- Not pushed yet. Intended target is `development` only.
