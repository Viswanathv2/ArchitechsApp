import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function VisitAnalyticsTab() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    loadVisits();
  }, []);

  async function loadVisits() {
    setLoading(true);
    const { data, error } = await supabase
      .from("page_visits")
      .select("page_slug, visitor_id");

    if (error) {
      setStatus({ type: "error", message: `Failed to load visits: ${error.message}` });
      setLoading(false);
      return;
    }

    // Count unique visitor_ids per page
    const uniqueVisitors = {};
    (data || []).forEach((row) => {
      const slug = row.page_slug || "unknown";
      const vid = row.visitor_id || "anon";
      if (!uniqueVisitors[slug]) {
        uniqueVisitors[slug] = new Set();
      }
      uniqueVisitors[slug].add(vid);
    });

    // Convert to array and sort by count descending
    const visitStats = Object.entries(uniqueVisitors)
      .map(([slug, visitors]) => ({
        slug,
        count: visitors.size
      }))
      .sort((a, b) => b.count - a.count);

    setVisits(visitStats);
    setLoading(false);
  }

  if (loading) return <p>Loading visit analytics...</p>;

  return (
    <div className="admin-section">
      <h2>Page Visit Analytics</h2>
      <p className="analytics-help">Unique visitors per page (deduped by visitor ID and page)</p>
      
      {visits.length ? (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Unique Visitors</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((item) => (
              <tr key={item.slug}>
                <td className="page-slug">{item.slug}</td>
                <td className="visit-count">{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No visits recorded yet.</p>
      )}

      <button className="admin-save-btn" onClick={loadVisits} style={{ marginTop: "16px" }}>
        Refresh Data
      </button>
    </div>
  );
}
