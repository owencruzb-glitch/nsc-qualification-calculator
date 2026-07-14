import { useEffect, useMemo, useRef, useState } from "react";
import BracketMatch from "./bracket-match";
import {
  buildKnockoutBracket,
  resetKnockoutBracket,
  seedQuarterfinals,
  selectKnockoutWinner,
} from "@/lib/bracket";

function BracketColumn({
  title,
  matches,
  teams,
  onSelectWinner,
  className = "",
  showMobileMatchHeadings = false,
}) {
  return (
    <section className={`bracket-round ${className}`} aria-label={title}>
      <h3>{title}</h3>
      <div className="bracket-round-matches">
        {matches.map((match) => {
          const matchCard = (
            <BracketMatch
              match={match}
              teams={teams}
              onSelectWinner={onSelectWinner}
            />
          );
          if (!showMobileMatchHeadings) {
            return <div key={match.id}>{matchCard}</div>;
          }
          return (
            <div className="bracket-final-stage" key={match.id}>
              <h3 className="mobile-bracket-stage-heading">
                {match.stage === "third" ? "Third Place" : "Final"}
              </h3>
              {matchCard}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function KnockoutBracket({
  teams,
  knockoutMatches,
  currentStandings,
  projectedStandings,
  projectedAvailable,
}) {
  const [source, setSource] = useState("current");
  const [selections, setSelections] = useState({});
  const wasProjectedAvailable = useRef(false);
  const standings = source === "projected" ? projectedStandings : currentStandings;
  const quarterfinalSeeds = useMemo(
    () => seedQuarterfinals(standings, knockoutMatches),
    [knockoutMatches, standings],
  );
  const bracket = useMemo(
    () => buildKnockoutBracket(quarterfinalSeeds, knockoutMatches, selections),
    [knockoutMatches, quarterfinalSeeds, selections],
  );

  useEffect(() => {
    if (projectedAvailable && !wasProjectedAvailable.current) {
      setSource("projected");
    }
    wasProjectedAvailable.current = projectedAvailable;
  }, [projectedAvailable]);

  function selectWinner(matchId, teamId) {
    setSelections(
      selectKnockoutWinner(
        bracket.selections,
        matchId,
        teamId,
        quarterfinalSeeds,
        knockoutMatches,
      ),
    );
  }

  function useProjectedStandings() {
    if (!projectedAvailable) return;
    setSource("projected");
  }

  function resetToCurrent() {
    setSource("current");
    setSelections(resetKnockoutBracket());
  }

  const quarterfinals = bracket.matches.filter((match) => match.stage === "qf");
  const semifinals = bracket.matches.filter((match) => match.stage === "sf");
  const finals = bracket.matches.filter(
    (match) => match.stage === "third" || match.stage === "final",
  );

  return (
    <section
      className="knockout-section tool-section"
      id="knockout-bracket"
      aria-labelledby="knockout-heading"
    >
      <div className="tool-heading knockout-heading">
        <div className="tool-number" aria-hidden="true">03</div>
        <div>
          <p className="eyebrow">Choose every winner</p>
          <h2 id="knockout-heading">Knockout Bracket</h2>
        </div>
        <p>Follow the path from the group tables to the champion.</p>
      </div>

      <div className="bracket-toolbar">
        <div>
          <p className="eyebrow">Bracket seeding</p>
          <strong>{source === "projected" ? "Projected group standings" : "Official current standings"}</strong>
          <p>
            {projectedAvailable
              ? "Every remaining group prediction is complete."
              : "Complete every remaining group prediction to use projected seeds."}
          </p>
        </div>
        <div className="bracket-actions">
          <button
            type="button"
            className="primary-button"
            onClick={useProjectedStandings}
            disabled={!projectedAvailable || source === "projected"}
          >
            Use projected group standings
          </button>
          <button type="button" className="secondary-button" onClick={resetToCurrent}>
            Reset to current standings
          </button>
        </div>
      </div>

      <div className="bracket-scroll" tabIndex="0" aria-label="Interactive knockout bracket">
        <div className="bracket-grid">
          <BracketColumn
            title="Quarterfinals"
            matches={quarterfinals}
            teams={teams}
            onSelectWinner={selectWinner}
          />
          <BracketColumn
            title="Semifinals"
            matches={semifinals}
            teams={teams}
            onSelectWinner={selectWinner}
            className="bracket-round-semifinals"
          />
          <BracketColumn
            title="Finals night"
            matches={finals}
            teams={teams}
            onSelectWinner={selectWinner}
            className="bracket-round-finals"
            showMobileMatchHeadings
          />
        </div>
      </div>

      <div className="bracket-summary" aria-live="polite">
        <div>
          <span>Champion</span>
          <strong>{bracket.champion ? teams[bracket.champion]?.name ?? bracket.champion : "Not selected"}</strong>
        </div>
        <div>
          <span>Third place</span>
          <strong>{bracket.thirdPlace ? teams[bracket.thirdPlace]?.name ?? bracket.thirdPlace : "Not selected"}</strong>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setSelections(resetKnockoutBracket())}
          disabled={Object.keys(bracket.selections).length === 0}
        >
          Reset knockout bracket
        </button>
      </div>
    </section>
  );
}
