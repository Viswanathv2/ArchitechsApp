import { useCallback, useEffect, useState } from "react";

// Full-screen media lightbox.
//   items: [{ url, type: "image"|"video", title, caption, date }]
//   index: current item index (controlled)
//   onClose / onIndex: callbacks
// Features: prev/next + keyboard (←/→/Esc), dot indicators, counter,
// caption + date credit, and a zoom toggle for images.
export default function Lightbox({ items, index, onClose, onIndex }) {
  const [zoomed, setZoomed] = useState(false);

  const count = items?.length || 0;
  const current = count ? items[index] : null;

  const go = useCallback(
    (next) => {
      if (!count) return;
      const wrapped = (next + count) % count;
      setZoomed(false);
      onIndex(wrapped);
    },
    [count, onIndex]
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    }
    document.addEventListener("keydown", onKey);
    // Lock background scroll while open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, go, onClose]);

  if (!current) return null;

  return (
    <div
      className="lightbox-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target.classList.contains("lightbox-overlay") || e.target.classList.contains("lightbox-stage")) {
          onClose();
        }
      }}
    >
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>

      {count > 1 ? (
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          onClick={() => go(index - 1)}
          aria-label="Previous"
        >
          ‹
        </button>
      ) : null}

      <div className="lightbox-stage">
        <div className={`lightbox-media${zoomed ? " zoomed" : ""}`} key={current.url}>
          {current.type === "video" ? (
            <video src={current.url} controls autoPlay playsInline />
          ) : (
            <img
              src={current.url}
              alt={current.title || ""}
              onClick={() => setZoomed((z) => !z)}
              role="button"
              title={zoomed ? "Click to zoom out" : "Click to zoom in"}
            />
          )}
        </div>

        {(current.title || current.caption || current.date) ? (
          <div className="lightbox-caption">
            {current.title ? <span className="lightbox-caption-title">{current.title}</span> : null}
            {current.caption ? <span className="lightbox-caption-desc">{current.caption}</span> : null}
            {current.date ? <span className="lightbox-caption-date">{current.date}</span> : null}
          </div>
        ) : null}

        <div className="lightbox-toolbar">
          {current.type !== "video" ? (
            <button
              type="button"
              className="lightbox-zoom-btn"
              onClick={() => setZoomed((z) => !z)}
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
            >
              {zoomed ? "－" : "＋"} Zoom
            </button>
          ) : null}
          {count > 1 ? <span className="lightbox-counter">{index + 1} / {count}</span> : null}
        </div>

        {count > 1 ? (
          <div className="lightbox-dots" role="tablist" aria-label="Media navigation">
            {items.map((it, i) => (
              <button
                key={it.url + i}
                type="button"
                className={`lightbox-dot${i === index ? " active" : ""}`}
                onClick={() => go(i)}
                aria-label={`Go to item ${i + 1}`}
                aria-selected={i === index}
              />
            ))}
          </div>
        ) : null}
      </div>

      {count > 1 ? (
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          onClick={() => go(index + 1)}
          aria-label="Next"
        >
          ›
        </button>
      ) : null}
    </div>
  );
}
