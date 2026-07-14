import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKnockoutBracket,
  calculateBracketSeedTables,
  resetKnockoutBracket,
  seedQuarterfinals,
  selectKnockoutWinner,
} from "../lib/bracket.js";

const knockoutMatches = [
  ["qf1", "qf", "Winner Group A vs Runner-up Group B"],
  ["qf2", "qf", "Winner Group B vs Runner-up Group A"],
  ["qf3", "qf", "Winner Group C vs Runner-up Group D"],
  ["qf4", "qf", "Winner Group D vs Runner-up Group C"],
  ["sf1", "sf", "Winner QF1 vs Winner QF3"],
  ["sf2", "sf", "Winner QF2 vs Winner QF4"],
  ["third", "third", "Semifinal losers"],
  ["final", "final", "Semifinal winners"],
].map(([id, stage, placeholder]) => ({
  id,
  stage,
  label: id,
  placeholder,
  date: "2026-07-18",
  time: "7:00 PM",
  home: null,
  away: null,
  homeScore: null,
  awayScore: null,
  status: "upcoming",
}));

const standings = Object.fromEntries(
  ["A", "B", "C", "D"].map((group) => [
    group,
    [1, 2, 3, 4].map((position) => ({
      teamId: `${group}${position}`,
      position,
      points: 4 - position,
      goalDifference: 0,
    })),
  ]),
);

const seeds = seedQuarterfinals(standings, knockoutMatches);

test("seeds all quarterfinals from the published group pairings", () => {
  assert.deepEqual(seeds, {
    qf1: ["A1", "B2"],
    qf2: ["B1", "A2"],
    qf3: ["C1", "D2"],
    qf4: ["D1", "C2"],
  });
});

test("QF1 and QF3 feed SF1 while QF2 and QF4 feed SF2", () => {
  const bracket = buildKnockoutBracket(seeds, knockoutMatches, {
    qf1: "A1",
    qf2: "B1",
    qf3: "D2",
    qf4: "C2",
  });
  const byId = Object.fromEntries(bracket.matches.map((match) => [match.id, match]));
  assert.deepEqual(byId.sf1.teams, ["A1", "D2"]);
  assert.deepEqual(byId.sf2.teams, ["B1", "C2"]);
});

test("semifinal winners feed the final and losers feed third place", () => {
  const bracket = buildKnockoutBracket(seeds, knockoutMatches, {
    qf1: "A1",
    qf2: "B1",
    qf3: "D2",
    qf4: "C2",
    sf1: "D2",
    sf2: "B1",
    final: "D2",
    third: "C2",
  });
  const byId = Object.fromEntries(bracket.matches.map((match) => [match.id, match]));
  assert.deepEqual(byId.final.teams, ["D2", "B1"]);
  assert.deepEqual(byId.third.teams, ["A1", "C2"]);
  assert.equal(bracket.champion, "D2");
  assert.equal(bracket.thirdPlace, "C2");
});

test("changing an earlier winner clears invalid downstream picks", () => {
  const complete = {
    qf1: "A1",
    qf2: "B1",
    qf3: "D2",
    qf4: "C2",
    sf1: "A1",
    sf2: "B1",
    final: "A1",
    third: "D2",
  };
  const changed = selectKnockoutWinner(
    complete,
    "qf1",
    "B2",
    seeds,
    knockoutMatches,
  );
  assert.deepEqual(changed, {
    qf1: "B2",
    qf2: "B1",
    qf3: "D2",
    qf4: "C2",
    sf2: "B1",
  });
});

test("resetting returns a fresh blank bracket", () => {
  assert.deepEqual(resetKnockoutBracket(), {});
  assert.notEqual(resetKnockoutBracket(), resetKnockoutBracket());
});

test("switching between current and projected standings changes seeds", () => {
  const projected = structuredClone(standings);
  [projected.A[0], projected.A[1]] = [projected.A[1], projected.A[0]];
  assert.deepEqual(seedQuarterfinals(standings, knockoutMatches).qf1, ["A1", "B2"]);
  assert.deepEqual(seedQuarterfinals(projected, knockoutMatches).qf1, ["A2", "B2"]);
});

test("seed calculations do not mutate source API data", () => {
  const teams = {
    A1: { name: "A1", group: "A" },
    A2: { name: "A2", group: "A" },
    A3: { name: "A3", group: "A" },
    A4: { name: "A4", group: "A" },
  };
  const matches = [
    { id: "a1", stage: "group", group: "A", home: "A1", away: "A2", homeScore: 1, awayScore: 0, status: "final" },
    { id: "a2", stage: "group", group: "A", home: "A3", away: "A4", homeScore: null, awayScore: null, status: "upcoming" },
  ];
  const predictions = { A: { a2: { homeScore: 2, awayScore: 1 } } };
  const snapshot = structuredClone({ teams, matches, predictions });
  const incompleteTables = calculateBracketSeedTables(teams, matches, {});
  const tables = calculateBracketSeedTables(teams, matches, predictions);

  assert.equal(incompleteTables.projectedAvailable, false);
  assert.equal(tables.projectedAvailable, true);
  assert.deepEqual({ teams, matches, predictions }, snapshot);
});
