import PageShell from "../components/PageShell";
import RouteLoading from "../components/RouteLoading";
import { usePortalPage } from "../hooks/usePortalPage";
import { useTrackVisit } from "../hooks/useTrackVisit";

export default function ResourcesPage() {
  const page = usePortalPage("resources");
  useTrackVisit("resources");

  if (page.loading) {
    return <RouteLoading />;
  }

  return <PageShell title={page.title} subtitle={page.subtitle} body={page.body} />;
}
