import { BLANK_SCORE, normalizeScoreInput } from "@/lib/simulatorUi";

function formatMatchDate(date, time) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
  return `${formattedDate} · ${time}`;
}

function ScoreStepper({ inputId, label, value, onChange }) {
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
          <span aria-hidden="true">−</span>
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          placeholder="–"
          onChange={(event) => {
            try {
              onChange(normalizeScoreInput(event.target.value));
            } catch {
              // Keep the last valid controlled value during invalid native input.
            }
          }}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(numericValue + 1)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}

export default function MatchPredictor({ match, teams, scores, onScoreChange }) {
  const homeName = teams[match.home].name;
  const awayName = teams[match.away].name;

  return (
    <article className="match-card" aria-label={`${homeName} versus ${awayName}`}>
      <div className="match-meta">
        <span>{homeName} vs {awayName}</span>
        <time dateTime={`${match.date} ${match.time}`}>
          {formatMatchDate(match.date, match.time)}
        </time>
      </div>
      <div className="match-teams">
        <ScoreStepper
          inputId={`score-${match.id}-home`}
          label={`${homeName} score`}
          value={scores.homeScore}
          onChange={(value) => onScoreChange(match.id, "homeScore", value)}
        />
        <span className="versus" aria-hidden="true">vs</span>
        <ScoreStepper
          inputId={`score-${match.id}-away`}
          label={`${awayName} score`}
          value={scores.awayScore}
          onChange={(value) => onScoreChange(match.id, "awayScore", value)}
        />
      </div>
    </article>
  );
}
