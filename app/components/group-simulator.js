"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QualificationScenarios from "./qualification-scenarios";
import MatchPredictor from "./match-predictor";
import KnockoutBracket from "./knockout-bracket";
import StandingsTable from "./standings-table";
import { calculateBracketSeedTables } from "@/lib/bracket";
import { getGroupMatches, groupTeamIds } from "@/lib/groups";
import {
  analyzeTeamQualification,
  createProjectedQualificationResult,
  createQualificationExplanations,
} from "@/lib/scenarios";
import { simulateGroup } from "@/lib/simulator";
import {
  createBlankPredictionState,
  createStandingsDisplay,
  getUnresolvedTieNotice,
  toCompletePredictions,
  updatePredictionScore,
} from "@/lib/simulatorUi";
import { calculateStandings } from "@/lib/standings";
import { MATCH_STATUS } from "@/types/tournament";

const GROUPS = ["A", "B", "C", "D"];

async function requestTournamentData() {
  const response = await fetch("/api/tournament", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "The live feed could not be loaded.");
  }
  return payload;
}

function findFirstOpenGroup(payload) {
  return (
    GROUPS.find((group) =>
      getGroupMatches(payload.matches, group).some(
        (match) => match.status !== MATCH_STATUS.FINAL,
      ),
    ) ?? GROUPS[0]
  );
}

function getInitialSelection(payload) {
  const group = findFirstOpenGroup(payload);
  const groupedTeams = groupTeamIds(payload.teams);
  return { group, teamId: groupedTeams[group]?.[0] ?? null };
}

function LoadingState() {
  return (
    <section className="state-card" aria-live="polite" aria-busy="true">
      <span className="loading-mark" aria-hidden="true" />
      <p className="eyebrow">Loading live tournament data</p>
      <h2>Setting up the groups…</h2>
      <p>The simulator will be ready in a moment.</p>
    </section>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <section className="state-card error-card" role="alert">
      <p className="eyebrow">Data unavailable</p>
      <h2>We couldn’t load the tournament.</h2>
      <p>{message}</p>
      <button className="primary-button" type="button" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}

export default function GroupSimulator() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState("A");
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [predictionsByGroup, setPredictionsByGroup] = useState({});

  const loadData = useCallback(async () => {
    try {
      const payload = await requestTournamentData();
      const selection = getInitialSelection(payload);
      setData(payload);
      setSelectedGroup(selection.group);
      setSelectedTeamId(selection.teamId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The live feed could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestTournamentData()
      .then((payload) => {
        if (!active) return;
        const selection = getInitialSelection(payload);
        setData(payload);
        setSelectedGroup(selection.group);
        setSelectedTeamId(selection.teamId);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The live feed could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function retryLoad() {
    setLoading(true);
    setError(null);
    loadData();
  }

  const groupModel = useMemo(() => {
    if (!data) return null;
    try {
      const groupedTeams = groupTeamIds(data.teams);
      const teamIds = groupedTeams[selectedGroup] ?? [];
      const matches = getGroupMatches(data.matches, selectedGroup);
      const remainingMatches = matches.filter(
        (match) => match.status !== MATCH_STATUS.FINAL,
      );

      if (teamIds.length !== 4 || matches.length !== 6) {
        throw new Error(`Group ${selectedGroup} does not have four teams and six group matches.`);
      }
      if (
        matches.some(
          (match) => !teamIds.includes(match.home) || !teamIds.includes(match.away),
        )
      ) {
        throw new Error(`Group ${selectedGroup} contains an invalid team reference.`);
      }

      const predictionState =
        predictionsByGroup[selectedGroup] ?? createBlankPredictionState(remainingMatches);
      const predictions = toCompletePredictions(predictionState);
      const current = createStandingsDisplay(calculateStandings(teamIds, matches));
      const projected = createStandingsDisplay(
        simulateGroup(teamIds, matches, predictions),
      );

      return {
        teamIds,
        matches,
        remainingMatches,
        predictionState,
        completedPredictionCount: predictions.length,
        current,
        projected,
        tieNotice: getUnresolvedTieNotice(projected),
      };
    } catch (modelError) {
      return {
        error: modelError instanceof Error ? modelError.message : "This group is malformed.",
      };
    }
  }, [data, predictionsByGroup, selectedGroup]);

  const qualificationAnalysis = useMemo(() => {
    if (!data || !selectedTeamId) return null;
    try {
      const groupedTeams = groupTeamIds(data.teams);
      const teamIds = groupedTeams[selectedGroup] ?? [];
      const matches = getGroupMatches(data.matches, selectedGroup);
      return analyzeTeamQualification(teamIds, matches, selectedTeamId);
    } catch (analysisError) {
      return {
        error:
          analysisError instanceof Error
            ? analysisError.message
            : "Qualification scenarios could not be calculated.",
      };
    }
  }, [data, selectedGroup, selectedTeamId]);

  const qualificationExplanations = useMemo(() => {
    if (!qualificationAnalysis || qualificationAnalysis.error || !data) return [];
    return createQualificationExplanations(qualificationAnalysis, data.teams);
  }, [data, qualificationAnalysis]);

  const projectedQualification = useMemo(() => {
    if (
      !qualificationAnalysis ||
      qualificationAnalysis.error ||
      !groupModel?.projected ||
      !selectedTeamId
    ) {
      return null;
    }
    return createProjectedQualificationResult(
      groupModel.projected,
      selectedTeamId,
      {
        completedPredictionCount: groupModel.completedPredictionCount,
        remainingMatchCount: groupModel.remainingMatches.length,
        currentStatus: qualificationAnalysis.overallStatus,
      },
    );
  }, [groupModel, qualificationAnalysis, selectedTeamId]);

  const bracketSeedTables = useMemo(() => {
    if (!data) return null;
    try {
      return calculateBracketSeedTables(
        data.teams,
        data.matches,
        predictionsByGroup,
      );
    } catch (bracketError) {
      return {
        error:
          bracketError instanceof Error
            ? bracketError.message
            : "The knockout bracket could not be seeded.",
      };
    }
  }, [data, predictionsByGroup]);

  function updateScore(matchId, side, value) {
    setPredictionsByGroup((allGroups) => {
      const currentState =
        allGroups[selectedGroup] ??
        createBlankPredictionState(groupModel.remainingMatches);
      return {
        ...allGroups,
        [selectedGroup]: updatePredictionScore(currentState, matchId, side, value),
      };
    });
  }

  function resetSelectedGroup() {
    setPredictionsByGroup((allGroups) => ({
      ...allGroups,
      [selectedGroup]: createBlankPredictionState(groupModel.remainingMatches),
    }));
  }

  const hasEnteredPredictions = groupModel?.predictionState
    ? Object.values(groupModel.predictionState).some(
        (scores) => scores.homeScore !== "" || scores.awayScore !== "",
      )
    : false;

  function selectGroup(group) {
    setSelectedGroup(group);
    if (data?.teams[selectedTeamId]?.group !== group) {
      const groupedTeams = groupTeamIds(data.teams);
      setSelectedTeamId(groupedTeams[group]?.[0] ?? null);
    }
  }

  function selectTeam(teamId) {
    const team = data?.teams[teamId];
    if (!team) return;
    setSelectedTeamId(teamId);
    setSelectedGroup(team.group);
  }

  function handleGroupTabKeyDown(event) {
    const currentIndex = GROUPS.indexOf(selectedGroup);
    let nextIndex = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % GROUPS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + GROUPS.length) % GROUPS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = GROUPS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextGroup = GROUPS[nextIndex];
    selectGroup(nextGroup);
    document.getElementById(`group-tab-${nextGroup}`)?.focus();
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retryLoad} />;

  if (
    !data ||
    groupModel?.error ||
    qualificationAnalysis?.error ||
    !selectedTeamId ||
    !qualificationAnalysis ||
    !projectedQualification
  ) {
    return (
      <ErrorState
        message={
          groupModel?.error ||
          qualificationAnalysis?.error ||
          "The group data is missing or malformed."
        }
        onRetry={retryLoad}
      />
    );
  }

  return (
    <>
      <QualificationScenarios
        teams={data.teams}
        selectedTeamId={selectedTeamId}
        onTeamChange={selectTeam}
        analysis={qualificationAnalysis}
        explanations={qualificationExplanations}
        projectedResult={projectedQualification}
        onReset={resetSelectedGroup}
        hasPredictions={hasEnteredPredictions}
      />

      <section
        className="tool-section simulator-section"
        id="group-simulator"
        aria-labelledby="simulator-heading"
      >
        <div className="tool-heading">
          <div className="tool-number" aria-hidden="true">02</div>
          <div>
            <p className="eyebrow">Enter the remaining scores</p>
            <h2 id="simulator-heading">Group Simulator</h2>
          </div>
          <p>See how each result changes the table.</p>
        </div>

        <div
          className="group-tabs"
          role="tablist"
          aria-label="Tournament groups"
          onKeyDown={handleGroupTabKeyDown}
        >
          {GROUPS.map((group) => (
            <button
              key={group}
              id={`group-tab-${group}`}
              type="button"
              role="tab"
              aria-selected={selectedGroup === group}
              aria-controls="group-simulator-panel"
              tabIndex={selectedGroup === group ? 0 : -1}
              onClick={() => selectGroup(group)}
            >
              <span>Group</span> {group}
            </button>
          ))}
        </div>

        <div
          id="group-simulator-panel"
          role="tabpanel"
          aria-labelledby={`group-tab-${selectedGroup}`}
          tabIndex={0}
          className="simulator-grid"
        >
          <StandingsTable
            title={`Group ${selectedGroup} now`}
            rows={groupModel.current}
            teams={data.teams}
          />

          <section className="prediction-panel">
          <div className="section-heading prediction-heading">
            <div>
              <p className="eyebrow">Your call</p>
              <h3>Predict the remaining matches</h3>
            </div>
            <button
              className="reset-button"
              type="button"
              onClick={resetSelectedGroup}
              disabled={!hasEnteredPredictions}
            >
              Reset predictions
            </button>
          </div>

          {groupModel.remainingMatches.length > 0 ? (
            <div className="match-list">
              {groupModel.remainingMatches.map((match) => (
                <MatchPredictor
                  key={match.id}
                  match={match}
                  teams={data.teams}
                  scores={groupModel.predictionState[match.id]}
                  onScoreChange={updateScore}
                />
              ))}
            </div>
          ) : (
            <div className="complete-message">
              <strong>Group complete</strong>
              <p>There are no remaining group matches to simulate.</p>
            </div>
          )}
          <p className="prediction-note">
            A match is included once both score fields are filled. Knockout matches are excluded.
          </p>
          </section>

          <StandingsTable
            title={`Projected Group ${selectedGroup}`}
            rows={groupModel.projected}
            teams={data.teams}
            baselineRows={groupModel.current}
            projected
          />
        </div>
      </section>

      {groupModel.tieNotice && (
        <aside className="tie-notice" role="status">
          <strong>Unresolved tie</strong>
          <p>{groupModel.tieNotice}</p>
        </aside>
      )}

      {bracketSeedTables?.error ? (
        <aside className="tie-notice" role="status">
          <strong>Bracket unavailable</strong>
          <p>{bracketSeedTables.error}</p>
        </aside>
      ) : bracketSeedTables ? (
        <KnockoutBracket
          teams={data.teams}
          knockoutMatches={data.matches}
          currentStandings={bracketSeedTables.current}
          projectedStandings={bracketSeedTables.projected}
          projectedAvailable={bracketSeedTables.projectedAvailable}
        />
      ) : null}

      <p className="data-note">
        Live source updated {new Date(data.updatedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </>
  );
}
