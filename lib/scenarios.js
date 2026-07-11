import { simulateGroup } from "./simulator.js";
import {
  QUALIFICATION_STATUS,
  MATCH_STAGE,
  MATCH_STATUS,
} from "../types/tournament.js";

const DEFAULT_MAX_SCORE = 8;
const DEFAULT_MAX_COMBINATIONS = 100_000;

/**
 * Count possible score combinations without enumerating them.
 * @param {number} matchCount @param {number} maxScore
 */
export function countScoreCombinations(matchCount, maxScore) {
  if (!Number.isInteger(matchCount) || matchCount < 0) {
    throw new TypeError("Match count must be a non-negative integer.");
  }
  if (!Number.isInteger(maxScore) || maxScore < 0) {
    throw new TypeError("Maximum score must be a non-negative integer.");
  }
  return (maxScore + 1) ** (matchCount * 2);
}

/**
 * Enumerate bounded predictions for unfinished group matches.
 * @param {import("@/types/tournament").Match[]} matches
 * @param {{maxScore?: number, maxCombinations?: number}=} options
 * @returns {Generator<import("@/types/tournament").ScorePrediction[]>}
 */
export function* enumeratePredictions(matches, options = {}) {
  const maxScore = options.maxScore ?? DEFAULT_MAX_SCORE;
  const maxCombinations = options.maxCombinations ?? DEFAULT_MAX_COMBINATIONS;
  const remaining = matches.filter(
    (match) =>
      match.stage === MATCH_STAGE.GROUP && match.status !== MATCH_STATUS.FINAL,
  );
  const combinationCount = countScoreCombinations(remaining.length, maxScore);

  if (!Number.isInteger(maxCombinations) || maxCombinations < 1) {
    throw new TypeError("Maximum combinations must be a positive integer.");
  }
  if (combinationCount > maxCombinations) {
    throw new RangeError(
      `${combinationCount} scenarios exceed the ${maxCombinations} combination limit.`,
    );
  }

  /** @type {import("@/types/tournament").ScorePrediction[]} */
  const current = [];
  function* visit(index) {
    if (index === remaining.length) {
      yield current.map((prediction) => ({ ...prediction }));
      return;
    }
    const match = remaining[index];
    for (let homeScore = 0; homeScore <= maxScore; homeScore += 1) {
      for (let awayScore = 0; awayScore <= maxScore; awayScore += 1) {
        current.push({ matchId: match.id, homeScore, awayScore });
        yield* visit(index + 1);
        current.pop();
      }
    }
  }

  yield* visit(0);
}

/**
 * Explore every bounded result combination and summarize qualification outcomes.
 * Boundary ties are treated as contested rather than certain.
 * @param {string[]} teamIds
 * @param {import("@/types/tournament").Match[]} matches
 * @param {{qualifyingPlaces?: number, maxScore?: number, maxCombinations?: number}=} options
 */
export function calculateQualificationScenarios(teamIds, matches, options = {}) {
  const qualifyingPlaces = options.qualifyingPlaces ?? 2;
  if (
    !Number.isInteger(qualifyingPlaces) ||
    qualifyingPlaces < 1 ||
    qualifyingPlaces >= teamIds.length
  ) {
    throw new RangeError("Qualifying places must be between 1 and team count minus 1.");
  }

  const summaries = new Map(
    teamIds.map((teamId) => [
      teamId,
      {
        teamId,
        bestPosition: teamIds.length,
        worstPosition: 1,
        definiteQualificationCount: 0,
        possibleQualificationCount: 0,
        unresolvedBoundaryCount: 0,
      },
    ]),
  );
  let scenarioCount = 0;

  for (const predictions of enumeratePredictions(matches, options)) {
    scenarioCount += 1;
    const table = simulateGroup(teamIds, matches, predictions);
    const boundaryRows = table.filter(
      (row) =>
        row.unresolvedTie &&
        (row.position === qualifyingPlaces || row.position === qualifyingPlaces + 1),
    );
    const boundaryIsUnresolved = boundaryRows.length > 0;

    for (const row of table) {
      const summary = summaries.get(row.teamId);
      summary.bestPosition = Math.min(summary.bestPosition, row.position);
      summary.worstPosition = Math.max(summary.worstPosition, row.position);
      if (row.position <= qualifyingPlaces) {
        summary.possibleQualificationCount += 1;
        if (!boundaryIsUnresolved || !row.unresolvedTie) {
          summary.definiteQualificationCount += 1;
        } else {
          summary.unresolvedBoundaryCount += 1;
        }
      } else if (boundaryIsUnresolved && row.unresolvedTie) {
        summary.possibleQualificationCount += 1;
        summary.unresolvedBoundaryCount += 1;
      }
    }
  }

  return {
    scenarioCount,
    maxScore: options.maxScore ?? DEFAULT_MAX_SCORE,
    qualifyingPlaces,
    teams: [...summaries.values()].map((summary) => ({
      ...summary,
      status:
        summary.definiteQualificationCount === scenarioCount
          ? QUALIFICATION_STATUS.QUALIFIED
          : summary.possibleQualificationCount === 0
            ? QUALIFICATION_STATUS.ELIMINATED
            : QUALIFICATION_STATUS.CONTESTED,
    })),
  };
}
