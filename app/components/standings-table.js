function formatGoalDifference(value) {
  return value > 0 ? `+${value}` : String(value);
}

function Difference({ value, suffix = "" }) {
  if (!value) return null;
  const direction = value > 0 ? "up" : "down";
  return (
    <span className={`table-difference difference-${direction}`}>
      <span aria-hidden="true">{value > 0 ? "+" : "−"}{Math.abs(value)}{suffix}</span>
      <span className="sr-only">{Math.abs(value)} {suffix || "places"} {direction}</span>
    </span>
  );
}

export default function StandingsTable({
  title,
  rows,
  teams,
  projected = false,
  baselineRows = [],
}) {
  const baselineByTeam = new Map(
    baselineRows.map((row) => [row.teamId, row]),
  );

  return (
    <section className={`table-card ${projected ? "projected" : "official"}`}>
      <div className="section-heading table-heading">
        <div>
          <p className="eyebrow">
            {projected ? "Based on your scores" : "Official current standings"}
          </p>
          <h3>{title}</h3>
        </div>
        <span className={`table-state ${projected ? "state-projected" : "state-official"}`}>
          {projected ? "Projected" : "Current"}
        </span>
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
            {rows.map((row) => {
              const baseline = baselineByTeam.get(row.teamId);
              const positionChange = baseline ? baseline.position - row.position : 0;
              const pointsChange = baseline ? row.points - baseline.points : 0;
              const goalDifferenceChange = baseline
                ? row.goalDifference - baseline.goalDifference
                : 0;
              const changed = Boolean(
                positionChange || pointsChange || goalDifferenceChange,
              );

              return (
                <tr
                  key={row.teamId}
                  className={`${row.qualifies ? "qualifying-row" : ""} ${changed ? "changed-row" : ""}`}
                >
                  <td>
                    <span className="position">{row.position}</span>
                    {projected && <Difference value={positionChange} />}
                  </td>
                  <th scope="row">
                    <span className="team-name">{teams[row.teamId].name}</span>
                    <span className="row-status">{row.qualificationLabel}</span>
                    {row.tieMessage && <span className="tie-label">Tie unresolved</span>}
                  </th>
                  <td>{row.played}</td>
                  <td>
                    <span>{formatGoalDifference(row.goalDifference)}</span>
                    {projected && <Difference value={goalDifferenceChange} suffix=" GD" />}
                  </td>
                  <td>
                    <strong>{row.points}</strong>
                    {projected && <Difference value={pointsChange} suffix=" pts" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="table-key"><span aria-hidden="true" /> Top two qualify</p>
    </section>
  );
}

