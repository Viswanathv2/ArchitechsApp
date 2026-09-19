import { portalDefaults } from "../config/portalPages";

export function usePortalPage(slug) {
  return {
    loading: false,
    title: portalDefaults[slug]?.title || "",
    subtitle: portalDefaults[slug]?.subtitle || "",
    body: portalDefaults[slug]?.body || "",
    contactEmail: portalDefaults[slug]?.contactEmail || ""
  };
}
