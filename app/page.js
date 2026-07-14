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
          <p className="eyebrow">Neighborhood World Cup · Qualification companion</p>
          <h1>Three tools.<br />One clear path.</h1>
        </div>
        <p className="hero-copy">
          Simulate the final group matches, then see exactly what every team needs.
        </p>
        <nav className="tool-index" aria-label="Page tools">
          <a href="#group-simulator"><span>01</span> Group Simulator</a>
          <a href="#qualification-scenarios"><span>02</span> Qualification Scenarios</a>
          <a href="#knockout-bracket"><span>03</span> Knockout Bracket</a>
        </nav>
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
