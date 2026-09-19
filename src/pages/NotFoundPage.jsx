import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="landing-page">
      <div className="landing-container">
        <section className="landing-section">
          <h2>Page not found</h2>
          <p>We could not find that page in the new SPA yet.</p>
          <Link className="cta-button primary" to="/">Go Home</Link>
        </section>
      </div>
    </section>
  );
}
