import { MATCH_STAGE, MATCH_STATUS } from "../types/tournament.js";

/** @param {number} score @param {string} label */
export function assertValidScore(score, label = "Score") {
  if (!Number.isInteger(score) || score < 0) {
    throw new TypeError(`${label} must be a non-negative integer.`);
  }
}

/** @param {string} teamId @returns {import("@/types/tournament").StandingRow} */
export function createStandingRow(teamId) {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    position: 0,
    unresolvedTie: false,
    unresolvedTieKey: null,
  };
}

/**
 * Return group-stage matches that contain complete scores.
 * Simulated matches are marked final by the simulator before reaching here.
 * @param {import("@/types/tournament").Match[]} matches
 */
export function getCompletedGroupMatches(matches) {
  return matches.filter(
    (match) =>
      match.stage === MATCH_STAGE.GROUP &&
      match.status === MATCH_STATUS.FINAL &&
      Number.isInteger(match.homeScore) &&
      Number.isInteger(match.awayScore),
  );
}

/**
 * Apply a match result to a cloned table map.
 * @param {Map<string, import("@/types/tournament").StandingRow>} table
 * @param {import("@/types/tournament").Match} match
 */
export function applyMatchToTable(table, match) {
  const home = table.get(match.home);
  const away = table.get(match.away);

  if (!home || !away) {
    throw new Error(`Match ${match.id} references a team outside the group.`);
  }

  assertValidScore(match.homeScore, `Home score for ${match.id}`);
  assertValidScore(match.awayScore, `Away score for ${match.id}`);

  home.played += 1;
  away.played += 1;
  home.goalsFor += match.homeScore;
  home.goalsAgainst += match.awayScore;
  away.goalsFor += match.awayScore;
  away.goalsAgainst += match.homeScore;

  if (match.homeScore > match.awayScore) {
    home.won += 1;
    away.lost += 1;
    home.points += 3;
  } else if (match.homeScore < match.awayScore) {
    away.won += 1;
    home.lost += 1;
    away.points += 3;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }

  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
}

/**
 * Calculate head-to-head points for teams tied on points and goal difference.
 * @param {string[]} teamIds
 * @param {import("@/types/tournament").Match[]} completedMatches
 */
function calculateHeadToHead(teamIds, completedMatches) {
  const tied = new Set(teamIds);
  const table = new Map(teamIds.map((teamId) => [teamId, createStandingRow(teamId)]));

  completedMatches
    .filter((match) => tied.has(match.home) && tied.has(match.away))
    .forEach((match) => applyMatchToTable(table, match));

  return table;
}

/**
 * Calculate standings using points, goal difference, head-to-head, then goals for.
 * A team-id fallback makes output deterministic; `unresolvedTie` identifies teams
 * still equal after every published sporting criterion.
 * @param {string[]} teamIds
 * @param {import("@/types/tournament").Match[]} matches
 * @returns {import("@/types/tournament").StandingRow[]}
 */
export function calculateStandings(teamIds, matches) {
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error("Team IDs must be unique.");
  }

  const table = new Map(teamIds.map((teamId) => [teamId, createStandingRow(teamId)]));
  const completedMatches = getCompletedGroupMatches(matches);
  completedMatches.forEach((match) => applyMatchToTable(table, match));

  const rows = [...table.values()];
  const headToHeadByTeam = new Map();
  const primaryTies = new Map();
  for (const row of rows) {
    const key = `${row.points}:${row.goalDifference}`;
    const tiedRows = primaryTies.get(key) ?? [];
    tiedRows.push(row);
    primaryTies.set(key, tiedRows);
  }

  for (const tiedRows of primaryTies.values()) {
    if (tiedRows.length < 2) continue;
    const miniTable = calculateHeadToHead(
      tiedRows.map((row) => row.teamId),
      completedMatches,
    );
    for (const row of tiedRows) {
      headToHeadByTeam.set(row.teamId, miniTable.get(row.teamId)?.points ?? 0);
    }
  }

  rows.sort((a, b) => {
    return (
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      (headToHeadByTeam.get(b.teamId) ?? 0) -
        (headToHeadByTeam.get(a.teamId) ?? 0) ||
      b.goalsFor - a.goalsFor ||
      a.teamId.localeCompare(b.teamId)
    );
  });

  rows.forEach((row, index) => {
    row.position = index + 1;
    const rowTieKey = `${row.points}:${row.goalDifference}:${headToHeadByTeam.get(row.teamId) ?? 0}:${row.goalsFor}`;
    const previous = rows[index - 1];
    const next = rows[index + 1];
    const tiedAfterPublishedRules = [previous, next].some(
      (other) =>
        other &&
        row.points === other.points &&
        row.goalDifference === other.goalDifference &&
        (headToHeadByTeam.get(row.teamId) ?? 0) ===
          (headToHeadByTeam.get(other.teamId) ?? 0) &&
        row.goalsFor === other.goalsFor,
    );
    row.unresolvedTie = tiedAfterPublishedRules;
    row.unresolvedTieKey = tiedAfterPublishedRules ? rowTieKey : null;
  });

  return rows;
}
