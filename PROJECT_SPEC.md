# NSC Qualification Calculator — Project Specification

## Product summary

NSC Qualification Calculator is a companion website for the Neighborhood World Cup. It helps visitors understand how remaining group matches affect qualification without reproducing features already available on the official tournament website.

## Scope

### In scope

#### Qualification Scenarios

- Show whether each team is mathematically qualified, mathematically eliminated, or still in contention.
- Summarize the best and worst position a team can reach across bounded score combinations.
- Allow scenarios to be calculated for one group at a time.
- Clearly disclose when a final position depends on an unresolved tie beyond the published tie-break rules.

#### Group Simulator

- Load completed and upcoming group matches from the tournament API.
- Let a user enter hypothetical scores for unfinished group matches.
- Recalculate the group table immediately from final results plus those predictions.
- Allow predictions to be changed or removed without mutating source data.

### Out of scope

- Match schedule pages
- Live standings pages
- Top-scorer pages
- Knockout bracket simulation
- Live match commentary or streaming
- Editing tournament data

## Data source

Endpoint: `https://nsc-world-cup.netlify.app/api/data`

Expected top-level fields:

- `config`: tournament title, subtitle, rules, and related configuration
- `teams`: object keyed by stable team ID
- `matches`: array containing group and knockout matches
- `updatedAt`: ISO timestamp for the source update

The service boundary validates the minimum shape needed by this project. UI and calculations consume the returned domain data and must not fetch the endpoint directly.

## Domain rules

- Current format: four groups of four; the top two teams in each group qualify.
- Points: win 3, draw 1, loss 0.
- Published tie-break order: goal difference, head-to-head, then goals for.
- Only final group matches count toward current standings.
- A simulated score counts only for an unfinished group match.
- Scores must be non-negative integers.
- If all published criteria remain equal, the tie is unresolved. Stable internal ordering must not be described as qualification certainty.

## Architecture

```text
app/          Next.js routes and presentation (future UI work)
lib/          Pure standings, simulation, and scenario calculations
services/     API URL, fetching, validation, and boundary errors
types/        Shared JSDoc domain models and constants
```

### Calculation flow

1. `services/tournamentApi.js` fetches and validates the source payload.
2. The caller selects a group and its group-stage matches.
3. `lib/simulator.js` applies valid predictions to unfinished matches.
4. `lib/standings.js` calculates and ranks table rows.
5. `lib/scenarios.js` enumerates bounded remaining results and summarizes qualification states.

## Public calculation capabilities

- Build blank table rows from team IDs.
- Apply completed match results without mutating inputs.
- Calculate and rank a group table.
- Resolve published head-to-head comparisons among otherwise tied teams.
- Apply, remove, and validate simulated results.
- Enumerate bounded possible scorelines.
- Calculate best/worst finishing positions and qualification frequency.
- Classify teams as `qualified`, `eliminated`, or `contested` when the explored result space is exhaustive.

## Scenario constraints

Score enumeration is finite, not a proof over unbounded soccer scores. Callers must supply or accept a maximum simulated score and a maximum combination count. Results include metadata describing the explored bounds. If combinations exceed the safety limit, calculation fails explicitly.

Unresolved sporting ties require special care. Scenario summaries track boundary ties so a deterministic internal array order is not mistaken for certainty.

## Error handling

- Network failures produce a `TournamentApiError` with a safe message and optional status/cause.
- Invalid payloads fail at the service boundary.
- Unknown team IDs, duplicate match IDs, invalid predictions, and invalid scores throw descriptive calculation errors.
- Scenario calculations reject invalid bounds and excessive combination counts.

## Non-functional requirements

- Calculations remain framework-independent and deterministic.
- API objects and caller-owned inputs are never mutated.
- Modules use JavaScript with JSDoc models, matching the existing repository.
- Lint and production build must pass before delivery.
- Qualification analysis must describe bounded possibilities, never probability.

## UI milestones

The Group Simulator and Qualification Scenarios are the two supported interface milestones. Qualification paths share simulator state but remain visually and conceptually distinct from the user's projected result.

### Acceptance criteria

- The interface exposes only Qualification Scenarios and Group Simulator.
- Loading, stale-data timestamp, empty, and API-error states are visible.
- Every simulated score can be reset.
- Qualification claims distinguish certainty from unresolved tie-break outcomes.
- Mobile and keyboard usage are supported.
