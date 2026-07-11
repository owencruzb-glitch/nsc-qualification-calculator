import test from "node:test";
import assert from "node:assert/strict";
import { applyPredictions, simulateGroup } from "../lib/simulator.js";
import {
  createBlankPredictionState,
  createStandingsDisplay,
  getUnresolvedTieNotice,
  normalizeScoreInput,
  updatePredictionScore,
} from "../lib/simulatorUi.js";

const teams = ["alpha", "bravo", "charlie", "delta"];
const matches = [
  { id: "m1", stage: "group", group: "A", home: "alpha", away: "bravo", homeScore: 2, awayScore: 0, status: "final" },
  { id: "m2", stage: "group", group: "A", home: "charlie", away: "delta", homeScore: 1, awayScore: 1, status: "final" },
  { id: "m3", stage: "group", group: "A", home: "alpha", away: "charlie", homeScore: null, awayScore: null, status: "upcoming" },
  { id: "m4", stage: "group", group: "A", home: "bravo", away: "delta", homeScore: null, awayScore: null, status: "upcoming" },
];

test("score input accepts blanks and non-negative integers", () => {
  assert.equal(normalizeScoreInput(""), "");
  assert.equal(normalizeScoreInput("0"), 0);
  assert.equal(normalizeScoreInput("12"), 12);
  assert.throws(() => normalizeScoreInput("-1"), /non-negative integer/);
  assert.throws(() => normalizeScoreInput("1.5"), /non-negative integer/);
  assert.throws(() => normalizeScoreInput("goal"), /non-negative integer/);
});

test("simulation applies scores without mutating source data", () => {
  const sourceSnapshot = structuredClone(matches);
  const simulated = applyPredictions(matches, [
    { matchId: "m3", homeScore: 0, awayScore: 3 },
  ]);

  assert.deepEqual(matches, sourceSnapshot);
  assert.notEqual(simulated, matches);
  assert.equal(simulated[2].status, "final");
  assert.equal(simulated[2].simulated, true);
  assert.equal(simulated[2].awayScore, 3);
});

test("standings display highlights exactly the top two", () => {
  const display = createStandingsDisplay(simulateGroup(teams, matches));
  assert.deepEqual(
    display.map(({ position, qualifies, qualificationLabel }) => ({ position, qualifies, qualificationLabel })),
    [
      { position: 1, qualifies: true, qualificationLabel: "Qualifying position" },
      { position: 2, qualifies: true, qualificationLabel: "Qualifying position" },
      { position: 3, qualifies: false, qualificationLabel: "Not qualifying" },
      { position: 4, qualifies: false, qualificationLabel: "Not qualifying" },
    ],
  );
});

test("reset returns every remaining score to blank", () => {
  const remaining = matches.slice(2);
  let state = createBlankPredictionState(remaining);
  state = updatePredictionScore(state, "m3", "homeScore", 4);
  state = updatePredictionScore(state, "m4", "awayScore", 2);

  const reset = createBlankPredictionState(remaining);
  assert.deepEqual(reset, {
    m3: { homeScore: "", awayScore: "" },
    m4: { homeScore: "", awayScore: "" },
  });
  assert.notDeepEqual(state, reset);
});

test("unresolved ties produce row and page rendering data", () => {
  const tiedRows = [
    { teamId: "alpha", position: 1, unresolvedTie: true },
    { teamId: "bravo", position: 2, unresolvedTie: true },
    { teamId: "charlie", position: 3, unresolvedTie: false },
  ];
  const display = createStandingsDisplay(tiedRows);

  assert.equal(display[0].tieMessage, "Level after all published tiebreakers; final order is unresolved.");
  assert.match(getUnresolvedTieNotice(display), /displayed order is not a confirmed sporting position/);
  assert.equal(getUnresolvedTieNotice([{ unresolvedTie: false }]), null);
});
