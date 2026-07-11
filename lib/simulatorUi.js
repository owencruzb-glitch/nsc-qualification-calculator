import { assertValidScore } from "./standings.js";

export const BLANK_SCORE = "";

/**
 * Convert an input value into a blank value or valid tournament score.
 * @param {string | number} value
 * @returns {"" | number}
 */
export function normalizeScoreInput(value) {
  if (value === "") return BLANK_SCORE;
  const score = typeof value === "number" ? value : Number(value);
  assertValidScore(score);
  return score;
}

/**
 * Create blank prediction state for the supplied remaining matches.
 * @param {import("@/types/tournament").Match[]} matches
 */
export function createBlankPredictionState(matches) {
  return Object.fromEntries(
    matches.map((match) => [
      match.id,
      { homeScore: BLANK_SCORE, awayScore: BLANK_SCORE },
    ]),
  );
}

/**
 * Update one score while preserving the rest of prediction state.
 * @param {Record<string, {homeScore: "" | number, awayScore: "" | number}>} state
 * @param {string} matchId
 * @param {"homeScore" | "awayScore"} side
 * @param {string | number} value
 */
export function updatePredictionScore(state, matchId, side, value) {
  if (!state[matchId]) throw new Error(`Unknown prediction match ${matchId}.`);
  if (side !== "homeScore" && side !== "awayScore") {
    throw new Error(`Unknown score side ${side}.`);
  }

  return {
    ...state,
    [matchId]: {
      ...state[matchId],
      [side]: normalizeScoreInput(value),
    },
  };
}

/**
 * Convert complete input rows to predictions. Partially blank matches are ignored.
 * @param {Record<string, {homeScore: "" | number, awayScore: "" | number}>} state
 */
export function toCompletePredictions(state) {
  return Object.entries(state).flatMap(([matchId, scores]) => {
    if (scores.homeScore === BLANK_SCORE || scores.awayScore === BLANK_SCORE) {
      return [];
    }
    return [{ matchId, homeScore: scores.homeScore, awayScore: scores.awayScore }];
  });
}

/**
 * Add accessible qualification and tie display data to table rows.
 * @param {import("@/types/tournament").StandingRow[]} standings
 * @param {number=} qualifyingPlaces
 */
export function createStandingsDisplay(standings, qualifyingPlaces = 2) {
  return standings.map((row) => ({
    ...row,
    qualifies: row.position <= qualifyingPlaces,
    qualificationLabel:
      row.position <= qualifyingPlaces ? "Qualifying position" : "Not qualifying",
    tieMessage: row.unresolvedTie
      ? "Level after all published tiebreakers; final order is unresolved."
      : null,
  }));
}

/**
 * Return the page-level unresolved-tie message when any row remains tied.
 * @param {Array<{unresolvedTie: boolean}>} standings
 */
export function getUnresolvedTieNotice(standings) {
  return standings.some((row) => row.unresolvedTie)
    ? "One or more teams remain level after goal difference, head-to-head, and goals for. Their displayed order is not a confirmed sporting position."
    : null;
}

