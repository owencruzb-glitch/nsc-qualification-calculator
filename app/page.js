import GroupSimulator from "./components/group-simulator";

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="NSC Qualification Calculator home">
          <span className="brand-mark">N</span>
          <span>NSC / 26</span>
        </a>
        <span className="companion-label">Unofficial companion</span>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Neighborhood World Cup · Qualification companion</p>
          <h1>Three tools.<br />One clear path.</h1>
        </div>
        <p className="hero-copy">
          See what every team needs, test the remaining group matches, then map the knockout path.
        </p>
        <nav className="tool-index" aria-label="Page tools">
          <a href="#qualification-scenarios"><span>01</span> Qualification Scenarios</a>
          <a href="#group-simulator"><span>02</span> Group Simulator</a>
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
