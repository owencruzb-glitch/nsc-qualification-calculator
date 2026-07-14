function formatDate(date) {
  if (!date) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

const ROUND_NAMES = {
  qf: "Quarterfinal",
  sf: "Semifinal",
  third: "Third place",
  final: "Final",
};

function getUndeterminedMessage(stage) {
  if (stage === "sf") {
    return "Select the required quarterfinal winners to populate this match.";
  }
  if (stage === "third" || stage === "final") {
    return "Select both semifinal winners to populate finals night.";
  }
  return "Complete the group standings to determine both teams.";
}

export default function BracketMatch({ match, teams, onSelectWinner }) {
  const availableTeams = match.teams.filter(Boolean);

  return (
    <article className="bracket-match-card" aria-labelledby={`bracket-${match.id}-title`}>
      <header className="bracket-match-header">
        <div>
          <p className="eyebrow">{ROUND_NAMES[match.stage] ?? match.stage}</p>
          <h4 id={`bracket-${match.id}-title`}>{match.label}</h4>
        </div>
        <p className="bracket-match-time">
          <time dateTime={`${match.date ?? ""} ${match.time ?? ""}`}>
            {formatDate(match.date)} · {match.time ?? "Time TBC"}
          </time>
        </p>
      </header>

      <div className="bracket-team-options" aria-label={`Select winner of ${match.label}`}>
        {match.teams.map((teamId, index) => {
          const sourceLabel = match.teamSources[index] ?? "Team to be determined";
          const teamName = teamId ? teams[teamId]?.name ?? teamId : sourceLabel;
          const selected = match.selectedWinner === teamId && Boolean(teamId);
          return (
            <button
              key={`${match.id}-${index}`}
              type="button"
              className={`bracket-team-button ${selected ? "is-winner" : ""}`}
              aria-pressed={selected}
              disabled={!teamId}
              onClick={() => teamId && onSelectWinner(match.id, teamId)}
            >
              <span>{teamName}</span>
              <span className="bracket-pick-label">
                {selected ? "Selected winner" : teamId ? "Choose winner" : "Not yet determined"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="bracket-match-status" aria-live="polite">
        {match.selectedWinner
          ? `Winner: ${teams[match.selectedWinner]?.name ?? match.selectedWinner}`
          : availableTeams.length === 2
            ? "Winner not selected"
            : getUndeterminedMessage(match.stage)}
      </p>
    </article>
  );
}
