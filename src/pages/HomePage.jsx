import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RouteLoading from "../components/RouteLoading";
import Lightbox from "../components/Lightbox";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";

const TEAM_PHOTO_URL = "/team-photo.jpg";
const V4_ROBOT_IMAGE_URL = "/robot-v4.jpg";
const HERO_STATS = [
  { value: "12", label: "Members" },
  { value: "8", label: "FLL Teams" },
  { value: "10K+", label: "Reached" },
  { value: "3rd Yr", label: "FTC" }
];

export default function HomePage() {
  const page = usePortalPage("home");
  useTrackVisit("home");
  const [lightboxItem, setLightboxItem] = useState(null);
  const [heroImageUrl, setHeroImageUrl] = useState(V4_ROBOT_IMAGE_URL);

  if (page.loading) {
    return <RouteLoading />;
  }

  const designUrl = heroImageUrl;
  const designTitle = "Robot AEGIS · V4 Final";
  const designCaption = "Mecanum drive · latest build concept";
  const designType = "image";

  return (
    <section className="landing-page home-v2-page">
      <section className="home-v2-hero">
        <div className="home-v2-left">
          <div className="home-v2-kicker">FTC #25795 · Mechanicsburg, PA · 2nd Year FTC · 8 Yrs FLL</div>
          <h1 className="home-v2-title">
            ARCHI<span>TECHS</span>
          </h1>
          <p className="home-v2-subtitle">Fail Fast, Learn Faster — Engineering the future.</p>
          <p className="home-v2-body">
            A student-led FIRST Tech Challenge team from Mechanicsburg, PA. 3rd-year FTC
            competitors backed by 8 years of FLL experience — building robot AEGIS,
            mentoring FLL teams, and reaching 10,000+ community members through STEM outreach.
            Recognized by Power Women for promoting girls in STEM.
          </p>

          <div className="home-v2-actions">
            <Link to="/about" className="home-v2-btn home-v2-btn-primary">Our Story</Link>
            <Link to="/about#community-impact" className="home-v2-btn home-v2-btn-secondary">
              <span className="home-v2-btn-icon" aria-hidden="true">♡</span>
              Our Impact
            </Link>
          </div>

          <div className="home-v2-stats">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="home-v2-stat">
                <div className="home-v2-stat-value">{stat.value}</div>
                <div className="home-v2-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="home-v2-design-card"
          onClick={() =>
            setLightboxItem({
              url: designUrl,
              type: designType,
              title: designTitle,
              caption: designCaption,
              date: ""
            })
          }
          aria-label={`Open latest robot design: ${designTitle}`}
        >
          <div className="home-v2-design-media">
            {designType === "video" ? (
              <video src={designUrl} muted loop autoPlay playsInline />
            ) : (
              <img
                src={designUrl}
                alt={designTitle}
                onError={() => {
                  setHeroImageUrl(TEAM_PHOTO_URL);
                }}
              />
            )}
          </div>
          <div className="home-v2-design-meta">
            <div className="home-v2-design-kicker">Latest Robot Design</div>
            <div className="home-v2-design-title">{designTitle}</div>
            <div className="home-v2-design-caption">{designCaption}</div>
          </div>
        </button>
      </section>

      {lightboxItem ? (
        <Lightbox
          items={[{
            url: lightboxItem.url,
            type: lightboxItem.type,
            title: lightboxItem.title,
            caption: lightboxItem.caption,
            date: lightboxItem.date
          }]}
          index={0}
          onClose={() => setLightboxItem(null)}
          onIndex={() => {}}
        />
      ) : null}
    </section>
  );
}
