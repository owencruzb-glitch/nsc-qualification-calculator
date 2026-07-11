import { MATCH_STAGE } from "../types/tournament.js";

/**
 * Group team IDs by the API's group label.
 * @param {Record<string, import("@/types/tournament").Team>} teams
 */
export function groupTeamIds(teams) {
  return Object.entries(teams).reduce((groups, [teamId, team]) => {
    if (!team.group) throw new Error(`Team ${teamId} has no group.`);
    groups[team.group] ??= [];
    groups[team.group].push(teamId);
    return groups;
  }, {});
}

/**
 * Select all group-stage matches for a group.
 * @param {import("@/types/tournament").Match[]} matches
 * @param {string} group
 */
export function getGroupMatches(matches, group) {
  return matches.filter(
    (match) => match.stage === MATCH_STAGE.GROUP && match.group === group,
  );
}
