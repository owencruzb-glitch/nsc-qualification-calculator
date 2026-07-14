import { simulateGroup } from "./simulator.js";
import {
  QUALIFICATION_STATUS,
  MATCH_STAGE,
  MATCH_STATUS,
} from "../types/tournament.js";

const DEFAULT_MAX_SCORE = 8;
const DEFAULT_MAX_COMBINATIONS = 100_000;

export const SCENARIO_STATUS = Object.freeze({
  GUARANTEED: "Guaranteed",
  POSSIBLE: "Possible",
  NEEDS_HELP: "Needs help",
  IMPOSSIBLE: "Impossible",
  UNRESOLVED: "Unresolved tie",
});

const RESULT = Object.freeze({
  WIN: "win",
  DRAW: "draw",
  LOSS: "loss",
});

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

/**
 * Classify one team's qualification outcome in a completed projected table.
 * @param {import("@/types/tournament").StandingRow[]} table
 * @param {string} teamId
 * @param {number=} qualifyingPlaces
 * @returns {"qualified" | "not-qualified" | "unresolved"}
 */
export function classifyQualificationOutcome(
  table,
  teamId,
  qualifyingPlaces = 2,
) {
  const row = table.find((candidate) => candidate.teamId === teamId);
  if (!row) throw new Error(`Unknown team ${teamId}.`);

  const aboveBoundary = table[qualifyingPlaces - 1];
  const belowBoundary = table[qualifyingPlaces];
  const boundaryIsUnresolved =
    Boolean(aboveBoundary?.unresolvedTieKey) &&
    aboveBoundary.unresolvedTieKey === belowBoundary?.unresolvedTieKey;

  if (boundaryIsUnresolved && row.unresolvedTieKey === aboveBoundary.unresolvedTieKey) {
    return "unresolved";
  }
  return row.position <= qualifyingPlaces ? "qualified" : "not-qualified";
}

/** @param {number} teamScore @param {number} opponentScore */
function getResult(teamScore, opponentScore) {
  if (teamScore > opponentScore) return RESULT.WIN;
  if (teamScore < opponentScore) return RESULT.LOSS;
  return RESULT.DRAW;
}

/**
 * Read a prediction from the selected team's perspective.
 * @param {import("@/types/tournament").Match} match
 * @param {import("@/types/tournament").ScorePrediction} prediction
 * @param {string} teamId
 */
function getTeamPrediction(match, prediction, teamId) {
  const isHome = match.home === teamId;
  const teamScore = isHome ? prediction.homeScore : prediction.awayScore;
  const opponentScore = isHome ? prediction.awayScore : prediction.homeScore;
  return {
    result: getResult(teamScore, opponentScore),
    margin: Math.abs(teamScore - opponentScore),
  };
}

/**
 * Classify a prediction for the match that does not contain the selected team.
 * @param {import("@/types/tournament").ScorePrediction} prediction
 */
function getOtherMatchResult(prediction) {
  if (prediction.homeScore > prediction.awayScore) return "home-win";
  if (prediction.homeScore < prediction.awayScore) return "away-win";
  return "draw";
}

/** @param {Array<{qualification: string}>} records */
function summarizeRecords(records) {
  const qualifiedCount = records.filter(
    (record) => record.qualification === "qualified",
  ).length;
  const unresolvedCount = records.filter(
    (record) => record.qualification === "unresolved",
  ).length;
  let status = SCENARIO_STATUS.IMPOSSIBLE;

  if (records.length > 0 && qualifiedCount === records.length) {
    status = SCENARIO_STATUS.GUARANTEED;
  } else if (qualifiedCount > 0 && qualifiedCount + unresolvedCount < records.length) {
    status = SCENARIO_STATUS.NEEDS_HELP;
  } else if (qualifiedCount > 0) {
    status = SCENARIO_STATUS.POSSIBLE;
  } else if (unresolvedCount > 0) {
    status = SCENARIO_STATUS.UNRESOLVED;
  }

  return {
    status,
    scenarioCount: records.length,
    qualifiedCount,
    unresolvedCount,
    isPossible: qualifiedCount > 0 || unresolvedCount > 0,
    isGuaranteed: records.length > 0 && qualifiedCount === records.length,
  };
}

/**
 * Summarize one selected-team result across margins and the other match.
 * @param {Array<{qualification: string, margin: number, otherResult: string|null}>} records
 */
function summarizeResult(records) {
  const summary = summarizeRecords(records);
  const marginValues = [...new Set(records.map((record) => record.margin))].sort(
    (a, b) => a - b,
  );
  const margins = Object.fromEntries(
    marginValues.map((margin) => [
      margin,
      summarizeRecords(records.filter((record) => record.margin === margin)),
    ]),
  );
  const otherResults = Object.fromEntries(
    ["home-win", "draw", "away-win"].map((otherResult) => [
      otherResult,
      summarizeRecords(
        records.filter((record) => record.otherResult === otherResult),
      ),
    ]),
  );

  return { ...summary, margins, otherResults };
}

/**
 * Find the smallest win margin that guarantees qualification regardless of the
 * other bounded scoreline.
 * @param {ReturnType<typeof summarizeResult>} winSummary
 */
function getMinimumGuaranteedWinMargin(winSummary) {
  const margins = Object.entries(winSummary.margins)
    .map(([margin, summary]) => ({ margin: Number(margin), summary }))
    .sort((a, b) => a.margin - b.margin);
  const candidate = margins.find((entry, index) =>
    margins.slice(index).every(({ summary }) => summary.isGuaranteed),
  );
  return candidate?.margin ?? null;
}

/**
 * Find the largest loss margin that still has a definite or unresolved path.
 * @param {ReturnType<typeof summarizeResult>} lossSummary
 */
function getMaximumPossibleLossMargin(lossSummary) {
  const margins = Object.entries(lossSummary.margins)
    .filter(([, summary]) => summary.isPossible)
    .map(([margin]) => Number(margin));
  return margins.length ? Math.max(...margins) : null;
}

/**
 * Analyze bounded qualification paths for one team. This function is pure and
 * returns summaries rather than raw scenario lists.
 * @param {string[]} teamIds
 * @param {import("@/types/tournament").Match[]} matches
 * @param {string} teamId
 * @param {{qualifyingPlaces?: number, maxScore?: number, maxCombinations?: number}=} options
 */
export function analyzeTeamQualification(
  teamIds,
  matches,
  teamId,
  options = {},
) {
  if (!teamIds.includes(teamId)) throw new Error(`Unknown team ${teamId}.`);
  const qualifyingPlaces = options.qualifyingPlaces ?? 2;
  const currentTable = calculateQualificationTable(teamIds, matches);
  const currentRow = currentTable.find((row) => row.teamId === teamId);
  const remainingMatches = matches.filter(
    (match) =>
      match.stage === MATCH_STAGE.GROUP && match.status !== MATCH_STATUS.FINAL,
  );
  const teamMatch = remainingMatches.find(
    (match) => match.home === teamId || match.away === teamId,
  );
  const otherMatch = remainingMatches.find((match) => match.id !== teamMatch?.id);
  /** @type {Array<{qualification: string, result: string|null, margin: number, otherResult: string|null}>} */
  const records = [];

  for (const predictions of enumeratePredictions(matches, options)) {
    const table = simulateGroup(teamIds, matches, predictions);
    const teamPrediction = teamMatch
      ? predictions.find((prediction) => prediction.matchId === teamMatch.id)
      : null;
    const otherPrediction = otherMatch
      ? predictions.find((prediction) => prediction.matchId === otherMatch.id)
      : null;
    const teamResult = teamPrediction
      ? getTeamPrediction(teamMatch, teamPrediction, teamId)
      : null;

    records.push({
      qualification: classifyQualificationOutcome(
        table,
        teamId,
        qualifyingPlaces,
      ),
      result: teamResult?.result ?? null,
      margin: teamResult?.margin ?? 0,
      otherResult: otherPrediction
        ? getOtherMatchResult(otherPrediction)
        : null,
    });
  }

  const allSummary = summarizeRecords(records);
  const outcomes = {
    win: summarizeResult(records.filter((record) => record.result === RESULT.WIN)),
    draw: summarizeResult(records.filter((record) => record.result === RESULT.DRAW)),
    loss: summarizeResult(records.filter((record) => record.result === RESULT.LOSS)),
  };

  return {
    teamId,
    currentRow: { ...currentRow },
    currentOutcome: classifyQualificationOutcome(
      currentTable,
      teamId,
      qualifyingPlaces,
    ),
    teamMatch: teamMatch ? { ...teamMatch } : null,
    otherMatch: otherMatch ? { ...otherMatch } : null,
    scenarioCount: records.length,
    maxScore: options.maxScore ?? DEFAULT_MAX_SCORE,
    overallStatus: allSummary.isGuaranteed
      ? SCENARIO_STATUS.GUARANTEED
      : !allSummary.isPossible
        ? SCENARIO_STATUS.IMPOSSIBLE
        : allSummary.status === SCENARIO_STATUS.UNRESOLVED
          ? SCENARIO_STATUS.UNRESOLVED
          : SCENARIO_STATUS.POSSIBLE,
    alreadyGuaranteed: allSummary.isGuaranteed,
    alreadyEliminated: !allSummary.isPossible,
    anyWinGuarantees: outcomes.win.isGuaranteed,
    drawGuarantees: outcomes.draw.isGuaranteed,
    drawNeedsHelp:
      outcomes.draw.qualifiedCount > 0 && !outcomes.draw.isGuaranteed,
    lossIsPossible: outcomes.loss.isPossible,
    minimumGuaranteedWinMargin: getMinimumGuaranteedWinMargin(outcomes.win),
    maximumPossibleLossMargin: getMaximumPossibleLossMargin(outcomes.loss),
    outcomes,
  };
}

/**
 * Keep the table calculation behind one helper so analysis never reimplements
 * standings logic.
 * @param {string[]} teamIds
 * @param {import("@/types/tournament").Match[]} matches
 */
function calculateQualificationTable(teamIds, matches) {
  return simulateGroup(teamIds, matches, []);
}

/**
 * Describe which broad result in the other match can help the selected team.
 * @param {ReturnType<typeof summarizeResult>} resultSummary
 * @param {import("@/types/tournament").Match|null} otherMatch
 * @param {Record<string, import("@/types/tournament").Team>} teams
 */
function explainOtherMatch(resultSummary, otherMatch, teams) {
  if (!otherMatch) return null;
  const possible = Object.entries(resultSummary.otherResults)
    .filter(([, summary]) => summary.isPossible)
    .map(([result]) => result);
  const homeName = teams[otherMatch.home]?.name ?? otherMatch.home;
  const awayName = teams[otherMatch.away]?.name ?? otherMatch.away;

  if (possible.length === 1) {
    if (possible[0] === "home-win") return `${homeName} need to beat ${awayName}.`;
    if (possible[0] === "away-win") return `${awayName} need to beat ${homeName}.`;
    return "The other match needs to finish level.";
  }
  if (possible.length === 2 && !possible.includes("away-win")) {
    return `${homeName} need to avoid defeat.`;
  }
  if (possible.length === 2 && !possible.includes("home-win")) {
    return `${awayName} need to avoid defeat.`;
  }
  if (possible.length > 0 && possible.length < 3) {
    return "The result of the other match is decisive.";
  }
  if (
    possible.length === 3 &&
    Object.values(resultSummary.otherResults).some(
      (summary) => !summary.isGuaranteed,
    )
  ) {
    return "The margin in the other match may also matter.";
  }
  return null;
}

/**
 * Generate concise display-ready explanations without hard-coded team names.
 * @param {ReturnType<typeof analyzeTeamQualification>} analysis
 * @param {Record<string, import("@/types/tournament").Team>} teams
 */
export function createQualificationExplanations(analysis, teams) {
  const teamName = teams[analysis.teamId]?.name ?? analysis.teamId;
  const explanations = [];
  const add = (status, text) => explanations.push({ status, text });

  if (analysis.alreadyGuaranteed) {
    add(SCENARIO_STATUS.GUARANTEED, `${teamName} have already secured a top-two place.`);
    return explanations;
  }
  if (analysis.alreadyEliminated) {
    add(SCENARIO_STATUS.IMPOSSIBLE, `${teamName} can no longer reach a top-two place.`);
    return explanations;
  }

  if (analysis.anyWinGuarantees) {
    add(SCENARIO_STATUS.GUARANTEED, "Any win guarantees qualification.");
  } else if (analysis.minimumGuaranteedWinMargin !== null) {
    add(
      SCENARIO_STATUS.GUARANTEED,
      `A win by ${analysis.minimumGuaranteedWinMargin} or more guarantees qualification.`,
    );
  } else if (analysis.outcomes.win.isPossible) {
    add(SCENARIO_STATUS.NEEDS_HELP, "A win can qualify them, but the other match may still matter.");
  } else {
    add(SCENARIO_STATUS.IMPOSSIBLE, "They cannot qualify with a win in the bounded score range.");
  }

  if (analysis.drawGuarantees) {
    add(SCENARIO_STATUS.GUARANTEED, "A draw guarantees qualification.");
  } else if (analysis.drawNeedsHelp) {
    add(SCENARIO_STATUS.NEEDS_HELP, "A draw can be enough, depending on the other match.");
    const otherHelp = explainOtherMatch(
      analysis.outcomes.draw,
      analysis.otherMatch,
      teams,
    );
    if (otherHelp) {
      add(
        SCENARIO_STATUS.NEEDS_HELP,
        `With a draw: ${otherHelp}`,
      );
    }
  } else if (analysis.outcomes.draw.status === SCENARIO_STATUS.UNRESOLVED) {
    add(
      SCENARIO_STATUS.UNRESOLVED,
      "A draw leaves qualification unresolved under the published tiebreakers.",
    );
  } else {
    add(SCENARIO_STATUS.IMPOSSIBLE, "They cannot qualify with a draw.");
  }

  if (analysis.lossIsPossible) {
    const margin = analysis.maximumPossibleLossMargin;
    add(
      analysis.outcomes.loss.qualifiedCount > 0
        ? SCENARIO_STATUS.POSSIBLE
        : SCENARIO_STATUS.UNRESOLVED,
      margin === 1
        ? "They can still qualify with a one-goal loss."
        : `A loss by ${margin} goals can still qualify them in the bounded scenarios.`,
    );
    const otherHelp = explainOtherMatch(
      analysis.outcomes.loss,
      analysis.otherMatch,
      teams,
    );
    if (otherHelp) {
      add(
        SCENARIO_STATUS.NEEDS_HELP,
        `With a loss: ${otherHelp}`,
      );
    }
  } else {
    add(SCENARIO_STATUS.IMPOSSIBLE, "They cannot qualify with a loss.");
  }

  if (
    [analysis.outcomes.win, analysis.outcomes.draw, analysis.outcomes.loss].some(
      (outcome) => outcome.unresolvedCount > 0,
    )
  ) {
    add(
      SCENARIO_STATUS.UNRESOLVED,
      "Some outcomes remain unresolved under the published tiebreakers.",
    );
  }

  return explanations.slice(0, 6);
}

/**
 * Describe the selected team's status under the user's current simulator input.
 * @param {import("@/types/tournament").StandingRow[]} table
 * @param {string} teamId
 * @param {{completedPredictionCount: number, remainingMatchCount: number, currentStatus: string, qualifyingPlaces?: number}} context
 */
export function createProjectedQualificationResult(table, teamId, context) {
  const row = table.find((candidate) => candidate.teamId === teamId);
  if (!row) throw new Error(`Unknown team ${teamId}.`);

  if (context.completedPredictionCount === 0) {
    return {
      status: context.currentStatus,
      text: "No simulated scores yet. This matches the current real standings.",
      row: { ...row },
    };
  }

  const outcome = classifyQualificationOutcome(
    table,
    teamId,
    context.qualifyingPlaces ?? 2,
  );
  if (context.completedPredictionCount < context.remainingMatchCount) {
    return {
      status: SCENARIO_STATUS.NEEDS_HELP,
      text:
        outcome === "qualified"
          ? "The partial simulation puts them in the top two, but another score is still blank."
          : "The partial simulation leaves them outside the top two, but another score is still blank.",
      row: { ...row },
    };
  }
  if (outcome === "unresolved") {
    return {
      status: SCENARIO_STATUS.UNRESOLVED,
      text: "These scores leave qualification unresolved under the published tiebreakers.",
      row: { ...row },
    };
  }
  if (outcome === "qualified") {
    return {
      status: SCENARIO_STATUS.POSSIBLE,
      text: "These simulated scores put them in a top-two position.",
      row: { ...row },
    };
  }
  return {
    status: SCENARIO_STATUS.IMPOSSIBLE,
    text: "These simulated scores leave them outside the top two.",
    row: { ...row },
  };
}
