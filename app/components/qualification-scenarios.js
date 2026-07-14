const GROUPS = ["A", "B", "C", "D"];

function StatusBadge({ status }) {
  return <span className={`scenario-status status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function formatGoalDifference(value) {
  return value > 0 ? `+${value}` : String(value);
}

function describeRemainingMatch(match, teamId, teams) {
  if (!match) return "Group stage complete";
  const opponentId = match.home === teamId ? match.away : match.home;
  const venue = match.home === teamId ? "vs" : "at";
  return `${venue} ${teams[opponentId].name}`;
}

function otherResultLabel(result, match, teams) {
  if (result === "draw") return "Draw";
  const winnerId = result === "home-win" ? match.home : match.away;
  return `${teams[winnerId].name} win`;
}

function chooseOtherMatchFocus(analysis) {
  if (analysis.drawNeedsHelp) return { key: "draw", label: "If they draw" };
  if (analysis.lossIsPossible) return { key: "loss", label: "If they lose" };
  if (!analysis.anyWinGuarantees && analysis.outcomes.win.isPossible) {
    return { key: "win", label: "If they win" };
  }
  return null;
}

const STATUS_PRIORITY = {
  Guaranteed: 0,
  Possible: 1,
  "Needs help": 2,
  Impossible: 3,
  "Unresolved tie": 4,
};

export default function QualificationScenarios({
  teams,
  selectedTeamId,
  onTeamChange,
  analysis,
  explanations,
  projectedResult,
  onReset,
  hasPredictions,
}) {
  const focus = chooseOtherMatchFocus(analysis);
  const selectedTeam = teams[selectedTeamId];
  const prioritizedExplanations = [...explanations]
    .sort(
      (a, b) =>
        (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99),
    )
    .slice(0, 5);

  return (
    <section
      className="qualification-section tool-section"
      id="qualification-scenarios"
      aria-labelledby="qualification-heading"
    >
      <div className="qualification-intro">
        <div className="qualification-title">
          <div className="tool-number" aria-hidden="true">01</div>
          <div>
            <p className="eyebrow">Choose a team, read the path</p>
            <h2 id="qualification-heading">Qualification Scenarios</h2>
            <p className="selected-team-question">What does {selectedTeam.name} need?</p>
          </div>
        </div>
        <div className="team-select-field">
          <label htmlFor="qualification-team">Choose a team</label>
          <select
            id="qualification-team"
            value={selectedTeamId}
            onChange={(event) => onTeamChange(event.target.value)}
          >
            {GROUPS.map((group) => (
              <optgroup key={group} label={`Group ${group}`}>
                {Object.entries(teams)
                  .filter(([, team]) => team.group === group)
                  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                  .map(([teamId, team]) => (
                    <option key={teamId} value={teamId}>{team.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="team-snapshot" aria-label={`${selectedTeam.name} current group status`}>
        <div><span>Group</span><strong>{selectedTeam.group}</strong></div>
        <div><span>Position</span><strong>{analysis.currentRow.position}</strong></div>
        <div><span>Points</span><strong>{analysis.currentRow.points}</strong></div>
        <div><span>Goal difference</span><strong>{formatGoalDifference(analysis.currentRow.goalDifference)}</strong></div>
        <div className="remaining-snapshot">
          <span>Remaining match</span>
          <strong>{describeRemainingMatch(analysis.teamMatch, selectedTeamId, teams)}</strong>
        </div>
      </div>

      <div className="qualification-columns">
        <article className="paths-card">
          <div className="scenario-card-heading">
            <div>
              <p className="eyebrow">From real results</p>
              <h3>Paths to the top two</h3>
            </div>
            <StatusBadge status={analysis.overallStatus} />
          </div>
          <ul className="scenario-list">
            {prioritizedExplanations.map((explanation, index) => (
              <li key={`${explanation.status}-${index}`}>
                <StatusBadge status={explanation.status} />
                <p>{explanation.text}</p>
              </li>
            ))}
          </ul>
          <p className="bounded-note">
            Checked all scorelines from 0–{analysis.maxScore}. This is bounded enumeration, not probability.
          </p>
        </article>

        <article className="projection-card" aria-live="polite">
          <div className="scenario-card-heading">
            <div>
              <p className="eyebrow">Your simulation</p>
              <h3>Projected result</h3>
            </div>
            <StatusBadge status={projectedResult.status} />
          </div>
          <div className="projected-team-result">
            <span className="projected-position">{projectedResult.row.position}</span>
            <div>
              <strong>{selectedTeam.name}</strong>
              <p>{projectedResult.text}</p>
            </div>
          </div>
          <dl className="projected-stats">
            <div><dt>Points</dt><dd>{projectedResult.row.points}</dd></div>
            <div><dt>Goal difference</dt><dd>{formatGoalDifference(projectedResult.row.goalDifference)}</dd></div>
          </dl>
          <button
            className="scenario-reset"
            type="button"
            onClick={onReset}
            disabled={!hasPredictions}
          >
            Reset predictions
          </button>
        </article>
      </div>

      {focus && analysis.otherMatch && (
        <article className="other-match-card">
          <div>
            <p className="eyebrow">The other match · {focus.label}</p>
            <h3>{teams[analysis.otherMatch.home].name} vs {teams[analysis.otherMatch.away].name}</h3>
          </div>
          <ul aria-label="Qualification status by result in the other match">
            {["home-win", "draw", "away-win"].map((result) => {
              const summary = analysis.outcomes[focus.key].otherResults[result];
              return (
                <li key={result}>
                  <span>{otherResultLabel(result, analysis.otherMatch, teams)}</span>
                  <StatusBadge status={summary.status} />
                </li>
              );
            })}
          </ul>
        </article>
      )}
    </section>
  );
}
