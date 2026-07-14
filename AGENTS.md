# NSC Qualification Calculator — Agent Guide

## Project mission

Build a focused companion to the Neighborhood World Cup website. This project owns only:

1. Qualification Scenarios
2. Group Simulator
3. Knockout Bracket Simulator

Do not duplicate the source website's schedule, live standings, top scorers, or general tournament coverage.

## Source of truth

- Tournament API: `https://nsc-world-cup.netlify.app/api/data`
- The API is remote and mutable. Never hard-code teams, groups, matches, or current scores into UI or calculation code.
- Tournament rules currently say four groups of four, two qualifiers per group, and the tie-break order: goal difference, head-to-head, then goals for.
- Treat unknown, missing, or malformed API data as an explicit error; do not silently invent tournament data.

## Architecture boundaries

- `app/`: routes, layouts, UI components, and UI composition only.
- `services/`: network access, response validation, and normalization at the API boundary.
- `lib/`: pure tournament calculations. Code here must not fetch data, access browser APIs, or render UI.
- `types/`: shared JSDoc models and domain constants for this JavaScript project.
- UI code may call services and pure calculations, but calculation modules must never import from `app/`.
- Prefer small, named, reusable pure functions. Do not mutate API objects or caller-owned arrays.

## Tournament calculation rules

- Only completed group-stage matches contribute to current standings.
- Simulator predictions may replace an unfinished group match, but must not overwrite a final result.
- Award three points for a win, one for a draw, and zero for a loss.
- Rank by points, goal difference, head-to-head, then goals for.
- Preserve unresolved ties explicitly. A stable team-id fallback may make output deterministic, but must not be presented as a sporting tie-break.
- Qualification scenario enumeration must be bounded. Reject work above the configured combination limit instead of freezing the app.
- Keep qualification count and score bounds configurable even though the current tournament advances two teams per group.
- Seed knockout matches from the API's published group-position placeholders, never from hard-coded current team names.
- QF1/QF3 feed SF1; QF2/QF4 feed SF2. Semifinal winners feed the final and losers feed third place.
- Clear downstream knockout selections whenever a changed seed or earlier winner makes them ineligible.

## Development workflow

1. Read `PROJECT_SPEC.md` and relevant existing files before changing behavior.
2. For Next.js framework work, read the relevant local guide in `node_modules/next/dist/docs/` because this repository uses Next.js 16.
3. Add calculation logic to `lib/`, API concerns to `services/`, and shared models to `types/`.
4. Keep the two product features distinct; shared primitives belong in `lib/`.
5. Run `npm run lint` and `npm run build` before handing off changes.
6. Do not commit unless the user explicitly asks.

## Quality expectations

- Document public functions with JSDoc, including inputs, outputs, and thrown errors.
- Validate scores as non-negative integers.
- Use team IDs as stable identifiers; names are display values.
- Avoid framework dependencies in `lib/` so calculations can be unit tested independently.
- Add tests when changing ranking, simulation, or scenario behavior.
- Never log full API payloads or expose internal errors directly to users.
