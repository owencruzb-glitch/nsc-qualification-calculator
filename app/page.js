import GroupSimulator from "./components/group-simulator";

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#simulator" aria-label="NSC Qualification Calculator home">
          <span className="brand-mark">N</span>
          <span>NSC / 26</span>
        </a>
        <span className="companion-label">Unofficial companion</span>
      </header>

      <section className="hero" id="simulator">
        <div>
          <p className="eyebrow">Neighborhood World Cup · Group stage</p>
          <h1>What happens<br />if they win?</h1>
        </div>
        <p className="hero-copy">
          Set the scores for the matches still to play. The table recalculates
          instantly using the tournament’s published tiebreakers.
        </p>
      </section>

      <GroupSimulator />

      <footer>
        <p>Built to explore qualification—not replace the official tournament coverage.</p>
        <a href="https://nsc-world-cup.netlify.app/" target="_blank" rel="noreferrer">
          Official Neighborhood World Cup site ↗
        </a>
      </footer>
    </main>
  );
}
