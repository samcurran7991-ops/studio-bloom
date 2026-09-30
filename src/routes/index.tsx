import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/studio-funnel";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Studio Funnel — PMU studio growth, calmly managed" }, { name: "description", content: "A lead-to-booking workspace designed for permanent makeup studios." }, { property: "og:title", content: "Studio Funnel" }, { property: "og:description", content: "A calm lead-to-booking workspace for permanent makeup studios." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <PageShell eyebrow="Lead to booking" title="A quieter way to grow your studio." description="Studio Funnel will bring enquiries, conversations, and bookings into one considered workspace." />;
}
