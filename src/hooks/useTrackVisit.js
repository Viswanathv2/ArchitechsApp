import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useTrackVisit(pageSlug) {
  useEffect(() => {
    if (!pageSlug) {
      return;
    }

    const sessionKey = `visit_counted_${pageSlug}`;
    if (sessionStorage.getItem(sessionKey)) {
      return;
    }
    sessionStorage.setItem(sessionKey, "1");

    let visitorId = localStorage.getItem("ftc_visitor_id");
    if (!visitorId) {
      visitorId = crypto.randomUUID
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("ftc_visitor_id", visitorId);
    }

    const today = new Date().toISOString().split("T")[0];

    supabase.from("page_visits").upsert(
      {
        page_slug: pageSlug,
        visitor_id: visitorId,
        visit_date: today,
        visited_at: new Date().toISOString()
      },
      { onConflict: "visitor_id,page_slug,visit_date", ignoreDuplicates: true }
    );
  }, [pageSlug]);
}
