import { getGroupMatches, groupTeamIds } from "./groups.js";
import { simulateGroup } from "./simulator.js";
import { toCompletePredictions } from "./simulatorUi.js";
import { calculateStandings } from "./standings.js";
import { MATCH_STAGE, MATCH_STATUS } from "../types/tournament.js";

const QUARTERFINAL_PLACEHOLDER =
  /^Winner Group ([A-Z]) vs Runner-up Group ([A-Z])$/;

const ROUND_ORDER = Object.freeze({ qf: 0, sf: 1, third: 2, final: 3 });

/**
 * Calculate current and simulated standings for every published group.
 * Simulated standings are available only after every unfinished group match has
 * a complete prediction. Source teams and matches are never mutated.
 * @param {Record<string, import("@/types/tournament").Team>} teams
 * @param {import("@/types/tournament").Match[]} matches
 * @param {Record<string, Record<string, {homeScore: ""|number, awayScore: ""|number}>>} predictionsByGroup
 */
export function calculateBracketSeedTables(
  teams,
  matches,
  predictionsByGroup = {},
) {
  const groupedTeams = groupTeamIds(teams);
  const groups = Object.keys(groupedTeams).sort();
  const current = {};
  const projected = {};
  let projectedAvailable = true;

  for (const group of groups) {
    const teamIds = groupedTeams[group];
    const groupMatches = getGroupMatches(matches, group);
    const remaining = groupMatches.filter(
      (match) => match.status !== MATCH_STATUS.FINAL,
    );
    const predictionState = predictionsByGroup[group] ?? {};
    const predictions = toCompletePredictions(predictionState);

    if (predictions.length !== remaining.length) projectedAvailable = false;
    current[group] = calculateStandings(teamIds, groupMatches);
    projected[group] = simulateGroup(teamIds, groupMatches, predictions);
  }

  return { current, projected, projectedAvailable };
}

/**
 * Seed quarterfinals by parsing the API's published pairing placeholders.
 * @param {Record<string, import("@/types/tournament").StandingRow[]>} standingsByGroup
 * @param {import("@/types/tournament").Match[]} knockoutMatches
 */
export function seedQuarterfinals(standingsByGroup, knockoutMatches) {
  const quarterfinals = knockoutMatches
    .filter((match) => match.stage === MATCH_STAGE.QUARTERFINAL)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (quarterfinals.length !== 4) {
    throw new Error("The tournament must publish exactly four quarterfinals.");
  }

  return Object.fromEntries(
    quarterfinals.map((match) => {
      const pairing = QUARTERFINAL_PLACEHOLDER.exec(match.placeholder ?? "");
      if (!pairing) {
        throw new Error(`Quarterfinal ${match.id} has an invalid pairing placeholder.`);
      }
      const homeTable = standingsByGroup[pairing[1]];
      const awayTable = standingsByGroup[pairing[2]];
      if (!homeTable?.[0] || !awayTable?.[1]) {
        throw new Error(`Quarterfinal ${match.id} references missing group standings.`);
      }
      return [match.id, [homeTable[0].teamId, awayTable[1].teamId]];
    }),
  );
}

/** @param {string|null|undefined} selection @param {(string|null)[]} teams */
function keepEligibleSelection(selection, teams) {
  return selection && teams.includes(selection) ? selection : null;
}

/** @param {(string|null)[]} teams @param {string|null} winner */
function loserOf(teams, winner) {
  if (!winner || teams.some((teamId) => !teamId)) return null;
  return teams.find((teamId) => teamId !== winner) ?? null;
}

/**
 * Build the full bracket and discard any selection whose team is no longer
 * eligible after an upstream seed or winner changes.
 * @param {Record<string, string[]>} quarterfinalSeeds
 * @param {import("@/types/tournament").Match[]} knockoutMatches
 * @param {Record<string, string>} selections
 */
export function buildKnockoutBracket(
  quarterfinalSeeds,
  knockoutMatches,
  selections = {},
) {
  const byId = new Map(
    knockoutMatches.map((match) => [match.id, { ...match }]),
  );
  const requiredIds = ["qf1", "qf2", "qf3", "qf4", "sf1", "sf2", "third", "final"];
  for (const matchId of requiredIds) {
    if (!byId.has(matchId)) throw new Error(`Missing knockout match ${matchId}.`);
  }

  const teamsByMatch = {
    qf1: [...quarterfinalSeeds.qf1],
    qf2: [...quarterfinalSeeds.qf2],
    qf3: [...quarterfinalSeeds.qf3],
    qf4: [...quarterfinalSeeds.qf4],
  };
  const sourcesByMatch = {
    qf1: byId.get("qf1").placeholder.split(" vs "),
    qf2: byId.get("qf2").placeholder.split(" vs "),
    qf3: byId.get("qf3").placeholder.split(" vs "),
    qf4: byId.get("qf4").placeholder.split(" vs "),
    sf1: ["Winner QF1", "Winner QF3"],
    sf2: ["Winner QF2", "Winner QF4"],
    third: ["Loser SF1", "Loser SF2"],
    final: ["Winner SF1", "Winner SF2"],
  };
  const validSelections = {};

  for (const matchId of ["qf1", "qf2", "qf3", "qf4"]) {
    const winner = keepEligibleSelection(selections[matchId], teamsByMatch[matchId]);
    if (winner) validSelections[matchId] = winner;
  }

  teamsByMatch.sf1 = [validSelections.qf1 ?? null, validSelections.qf3 ?? null];
  teamsByMatch.sf2 = [validSelections.qf2 ?? null, validSelections.qf4 ?? null];
  for (const matchId of ["sf1", "sf2"]) {
    const winner = keepEligibleSelection(selections[matchId], teamsByMatch[matchId]);
    if (winner) validSelections[matchId] = winner;
  }

  teamsByMatch.final = [validSelections.sf1 ?? null, validSelections.sf2 ?? null];
  teamsByMatch.third = [
    loserOf(teamsByMatch.sf1, validSelections.sf1 ?? null),
    loserOf(teamsByMatch.sf2, validSelections.sf2 ?? null),
  ];
  for (const matchId of ["third", "final"]) {
    const winner = keepEligibleSelection(selections[matchId], teamsByMatch[matchId]);
    if (winner) validSelections[matchId] = winner;
  }

  const matches = requiredIds
    .map((matchId) => ({
      ...byId.get(matchId),
      teams: [...teamsByMatch[matchId]],
      teamSources: [...sourcesByMatch[matchId]],
      selectedWinner: validSelections[matchId] ?? null,
      teamsDetermined: teamsByMatch[matchId].every(Boolean),
    }))
    .sort(
      (a, b) =>
        ROUND_ORDER[a.stage] - ROUND_ORDER[b.stage] || a.id.localeCompare(b.id),
    );

  return {
    matches,
    selections: validSelections,
    champion: validSelections.final ?? null,
    thirdPlace: validSelections.third ?? null,
  };
}

/**
 * Apply one winner selection and sanitize every downstream selection.
 * @param {Record<string, string>} selections
 * @param {string} matchId
 * @param {string} teamId
 * @param {Record<string, string[]>} quarterfinalSeeds
 * @param {import("@/types/tournament").Match[]} knockoutMatches
 */
export function selectKnockoutWinner(
  selections,
  matchId,
  teamId,
  quarterfinalSeeds,
  knockoutMatches,
) {
  if (!knockoutMatches.some((match) => match.id === matchId)) {
    throw new Error(`Unknown knockout match ${matchId}.`);
  }
  return buildKnockoutBracket(
    quarterfinalSeeds,
    knockoutMatches,
    { ...selections, [matchId]: teamId },
  ).selections;
}

/** Return a new blank selection object. */
export function resetKnockoutBracket() {
  return {};
}
