import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeTeamQualification,
  createProjectedQualificationResult,
  SCENARIO_STATUS,
} from "../lib/scenarios.js";
import { simulateGroup } from "../lib/simulator.js";

const teamIds = ["alpha", "bravo", "charlie", "delta"];

function match(id, home, away, homeScore, awayScore, status = "final") {
  return {
    id,
    stage: "group",
    group: "A",
    home,
    away,
    homeScore,
    awayScore,
    status,
  };
}

const openGroup = [
  match("m1", "alpha", "bravo", 1, 0),
  match("m2", "alpha", "charlie", 0, 0),
  match("m3", "bravo", "delta", 1, 0),
  match("m4", "charlie", "delta", 2, 0),
  match("m5", "alpha", "delta", null, null, "upcoming"),
  match("m6", "bravo", "charlie", null, null, "upcoming"),
];

const boundedOptions = { maxScore: 3, maxCombinations: 10_000 };

test("identifies a team guaranteed to qualify with any win", () => {
  const analysis = analyzeTeamQualification(
    teamIds,
    openGroup,
    "alpha",
    boundedOptions,
  );
  assert.equal(analysis.alreadyGuaranteed, false);
  assert.equal(analysis.anyWinGuarantees, true);
  assert.equal(analysis.outcomes.win.status, SCENARIO_STATUS.GUARANTEED);
});

test("identifies when a draw depends on the other result", () => {
  const analysis = analyzeTeamQualification(
    teamIds,
    openGroup,
    "bravo",
    boundedOptions,
  );
  assert.equal(analysis.drawGuarantees, false);
  assert.equal(analysis.drawNeedsHelp, true);
  assert.equal(analysis.outcomes.draw.status, SCENARIO_STATUS.NEEDS_HELP);
});

test("identifies a team that can qualify with a loss", () => {
  const analysis = analyzeTeamQualification(
    teamIds,
    openGroup,
    "alpha",
    boundedOptions,
  );
  assert.equal(analysis.alreadyGuaranteed, false);
  assert.equal(analysis.lossIsPossible, true);
  assert.ok(analysis.maximumPossibleLossMargin >= 1);
});

test("identifies a team that cannot qualify", () => {
  const analysis = analyzeTeamQualification(
    teamIds,
    openGroup,
    "delta",
    boundedOptions,
  );
  assert.equal(analysis.alreadyEliminated, true);
  assert.equal(analysis.overallStatus, SCENARIO_STATUS.IMPOSSIBLE);
});

test("preserves unresolved qualification ties", () => {
  const analysis = analyzeTeamQualification(teamIds, [], "bravo", boundedOptions);
  assert.equal(analysis.overallStatus, SCENARIO_STATUS.UNRESOLVED);
  assert.equal(analysis.currentOutcome, "unresolved");
});

test("projected explanation updates after simulator scores are complete", () => {
  const analysis = analyzeTeamQualification(
    teamIds,
    openGroup,
    "bravo",
    boundedOptions,
  );
  const currentTable = simulateGroup(teamIds, openGroup);
  const current = createProjectedQualificationResult(
    currentTable,
    "bravo",
    {
      completedPredictionCount: 0,
      remainingMatchCount: 2,
      currentStatus: analysis.overallStatus,
    },
  );
  const simulatedTable = simulateGroup(teamIds, openGroup, [
    { matchId: "m5", homeScore: 2, awayScore: 0 },
    { matchId: "m6", homeScore: 2, awayScore: 0 },
  ]);
  const projected = createProjectedQualificationResult(
    simulatedTable,
    "bravo",
    {
      completedPredictionCount: 2,
      remainingMatchCount: 2,
      currentStatus: analysis.overallStatus,
    },
  );

  assert.match(current.text, /current real standings/);
  assert.equal(projected.status, SCENARIO_STATUS.POSSIBLE);
  assert.match(projected.text, /top-two position/);
});

test("qualification analysis does not mutate source API data", () => {
  const source = {
    teams: Object.fromEntries(
      teamIds.map((teamId) => [teamId, { name: teamId, group: "A" }]),
    ),
    matches: structuredClone(openGroup),
  };
  const snapshot = structuredClone(source);

  analyzeTeamQualification(
    teamIds,
    source.matches,
    "alpha",
    boundedOptions,
  );
  assert.deepEqual(source, snapshot);
});
