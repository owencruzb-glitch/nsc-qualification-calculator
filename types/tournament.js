/**
 * Shared domain models for the tournament API and calculation modules.
 * This project uses JavaScript, so JSDoc provides editor and tooling support.
 */

/** @typedef {"group" | "qf" | "sf" | "third" | "final"} TournamentStage */
/** @typedef {"upcoming" | "live" | "final"} MatchStatus */

/**
 * @typedef {object} Team
 * @property {string} name
 * @property {string} group
 * @property {string=} crest
 * @property {Array<{name: string, goals: number}>=} players
 */

/**
 * @typedef {object} Match
 * @property {string} id
 * @property {TournamentStage|string} stage
 * @property {string=} label
 * @property {string=} placeholder
 * @property {string=} date
 * @property {string=} time
 * @property {string|null=} group
 * @property {string|null} home
 * @property {string|null} away
 * @property {number|null} homeScore
 * @property {number|null} awayScore
 * @property {MatchStatus|string} status
 * @property {string|null=} half
 * @property {Array<object>=} scorers
 */

/**
 * @typedef {object} TournamentData
 * @property {Record<string, Team>} teams
 * @property {Match[]} matches
 * @property {{title?: string, subtitle?: string, rules?: string[]}} config
 * @property {string} updatedAt
 */

/**
 * @typedef {object} StandingRow
 * @property {string} teamId
 * @property {number} played
 * @property {number} won
 * @property {number} drawn
 * @property {number} lost
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 * @property {number} goalDifference
 * @property {number} points
 * @property {number} position
 * @property {boolean} unresolvedTie
 * @property {string|null} unresolvedTieKey
 */

/**
 * @typedef {object} ScorePrediction
 * @property {string} matchId
 * @property {number} homeScore
 * @property {number} awayScore
 */

export const MATCH_STATUS = Object.freeze({
  UPCOMING: "upcoming",
  LIVE: "live",
  FINAL: "final",
});

export const MATCH_STAGE = Object.freeze({
  GROUP: "group",
  QUARTERFINAL: "qf",
  SEMIFINAL: "sf",
  THIRD_PLACE: "third",
  FINAL: "final",
});

export const QUALIFICATION_STATUS = Object.freeze({
  QUALIFIED: "qualified",
  ELIMINATED: "eliminated",
  CONTESTED: "contested",
});
