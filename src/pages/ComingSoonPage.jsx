export default function ComingSoonPage({ title, subtitle }) {
  return (
    <section className="landing-page">
      <header className="landing-header">
        <h1>{title}</h1>
        <p className="landing-tagline">{subtitle || "More features are on the way"}</p>
      </header>

      <div className="landing-container">
        <section className="landing-section">
          <h2>Coming Soon</h2>
          <p>
            This page is currently under development. Check back soon for updates.
          </p>
        </section>
      </div>
    </section>
  );
}
