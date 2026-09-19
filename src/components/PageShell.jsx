export default function PageShell({ title, subtitle, body, children }) {
  const lines = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{title}</h1>
        {subtitle ? <p className="landing-tagline">{subtitle}</p> : null}
      </header>
      <div className="landing-container">
        {lines.length ? (
          <section className="landing-section">
            <div className="content-box">
              {lines.map((line, idx) => (
                <p key={`${line}-${idx}`}>{line}</p>
              ))}
            </div>
          </section>
        ) : null}
        {children}
      </div>
    </section>
  );
}
