"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getGroupMatches, groupTeamIds } from "@/lib/groups";
import { simulateGroup } from "@/lib/simulator";
import {
  BLANK_SCORE,
  createBlankPredictionState,
  createStandingsDisplay,
  getUnresolvedTieNotice,
  normalizeScoreInput,
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

function Stepper({ inputId, label, value, onChange }) {
  const numericValue = value === BLANK_SCORE ? 0 : value;

  return (
    <div className="score-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(0, numericValue - 1))}
          disabled={numericValue === 0}
        >
          −
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          placeholder="–"
          aria-label={label}
          onChange={(event) => {
            try {
              onChange(normalizeScoreInput(event.target.value));
            } catch {
              // Native number inputs can briefly emit invalid text; keep the last valid score.
            }
          }}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(numericValue + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function StandingsTable({ title, rows, teams, projected }) {
  return (
    <section className={`table-card ${projected ? "projected" : ""}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{projected ? "Updates instantly" : "From final results"}</p>
          <h2>{title}</h2>
        </div>
        {projected && <span className="live-pill">Projection</span>}
      </div>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Pos</th>
              <th scope="col">Team</th>
              <th scope="col">P</th>
              <th scope="col">GD</th>
              <th scope="col">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.teamId}
                className={row.qualifies ? "qualifying-row" : undefined}
              >
                <td>
                  <span className="position">{row.position}</span>
                </td>
                <th scope="row">
                  <span className="team-name">{teams[row.teamId].name}</span>
                  <span className="row-status">{row.qualificationLabel}</span>
                  {row.tieMessage && <span className="tie-label">Tie unresolved</span>}
                </th>
                <td>{row.played}</td>
                <td>{row.goalDifference > 0 ? "+" : ""}{row.goalDifference}</td>
                <td><strong>{row.points}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-key"><span aria-hidden="true" /> Top two qualify</p>
    </section>
  );
}

function MatchPredictor({ match, teams, scores, onScoreChange }) {
  return (
    <article className="match-card">
      <div className="match-meta">
        <span>Remaining match</span>
        <time dateTime={`${match.date} ${match.time}`}>{match.date} · {match.time}</time>
      </div>
      <div className="match-teams">
        <Stepper
          inputId={`score-${match.id}-home`}
          label={`${teams[match.home].name} predicted score`}
          value={scores.homeScore}
          onChange={(value) => onScoreChange(match.id, "homeScore", value)}
        />
        <span className="versus" aria-hidden="true">vs</span>
        <Stepper
          inputId={`score-${match.id}-away`}
          label={`${teams[match.away].name} predicted score`}
          value={scores.awayScore}
          onChange={(value) => onScoreChange(match.id, "awayScore", value)}
        />
      </div>
    </article>
  );
}

export default function GroupSimulator() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState("A");
  const [predictionsByGroup, setPredictionsByGroup] = useState({});

  const loadData = useCallback(async () => {
    try {
      const payload = await requestTournamentData();
      setData(payload);
      setSelectedGroup(findFirstOpenGroup(payload));
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
        setData(payload);
        setSelectedGroup(findFirstOpenGroup(payload));
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
    setSelectedGroup(nextGroup);
    document.getElementById(`group-tab-${nextGroup}`)?.focus();
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retryLoad} />;

  if (!data || groupModel?.error) {
    return (
      <ErrorState
        message={groupModel?.error || "The group data is missing or malformed."}
        onRetry={retryLoad}
      />
    );
  }

  return (
    <>
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
            onClick={() => setSelectedGroup(group)}
          >
            <span>Group</span> {group}
          </button>
        ))}
      </div>

      <section
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
              <h2>Predict the remaining matches</h2>
            </div>
            <button
              className="reset-button"
              type="button"
              onClick={resetSelectedGroup}
              disabled={groupModel.remainingMatches.length === 0}
            >
              Reset group
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
          projected
        />
      </section>

      {groupModel.tieNotice && (
        <aside className="tie-notice" role="status">
          <strong>Unresolved tie</strong>
          <p>{groupModel.tieNotice}</p>
        </aside>
      )}

      <p className="data-note">
        Live source updated {new Date(data.updatedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </>
  );
}
