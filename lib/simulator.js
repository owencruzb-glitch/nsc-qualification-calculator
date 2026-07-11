import { calculateStandings, assertValidScore } from "./standings.js";
import { MATCH_STAGE, MATCH_STATUS } from "../types/tournament.js";

/**
 * Apply predictions to unfinished group matches without mutating source matches.
 * @param {import("@/types/tournament").Match[]} matches
 * @param {import("@/types/tournament").ScorePrediction[]} predictions
 */
export function applyPredictions(matches, predictions) {
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const predictionsById = new Map();

  for (const prediction of predictions) {
    if (predictionsById.has(prediction.matchId)) {
      throw new Error(`Duplicate prediction for match ${prediction.matchId}.`);
    }
    const match = matchesById.get(prediction.matchId);
    if (!match) throw new Error(`Unknown match ${prediction.matchId}.`);
    if (match.stage !== MATCH_STAGE.GROUP) {
      throw new Error(`Match ${prediction.matchId} is not a group match.`);
    }
    if (match.status === MATCH_STATUS.FINAL) {
      throw new Error(`Final match ${prediction.matchId} cannot be simulated.`);
    }
    assertValidScore(prediction.homeScore, `Home score for ${prediction.matchId}`);
    assertValidScore(prediction.awayScore, `Away score for ${prediction.matchId}`);
    predictionsById.set(prediction.matchId, prediction);
  }

  return matches.map((match) => {
    const prediction = predictionsById.get(match.id);
    return prediction
      ? {
          ...match,
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
          status: MATCH_STATUS.FINAL,
          simulated: true,
        }
      : { ...match };
  });
}

/**
 * Calculate a simulated table for one group.
 * @param {string[]} teamIds
 * @param {import("@/types/tournament").Match[]} matches
 * @param {import("@/types/tournament").ScorePrediction[]} predictions
 */
export function simulateGroup(teamIds, matches, predictions = []) {
  return calculateStandings(teamIds, applyPredictions(matches, predictions));
}
