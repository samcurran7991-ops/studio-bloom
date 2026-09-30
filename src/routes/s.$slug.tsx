import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { DEMO_STUDIO } from "@/engine/demoStudio";
import type { Studio } from "@/engine/types";
import { StudioLanding } from "@/components/studio-landing";

// Design phase: every slug shows the demo studio, with texting on.
const studioFor = (slug: string): Studio => ({ ...DEMO_STUDIO, slug, texting: true });

export const Route = createFileRoute("/s/$slug")({
  head: () => {
    const c = DEMO_STUDIO.config;
    const title = `${c.name} — Natural brows & lips that heal beautifully`;
    const description = `Find your permanent makeup match in 30 seconds, see clear prices and meet ${c.artist.name} at ${c.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: StudioPage,
});

function StudioPage() {
  const { slug } = Route.useParams();
  const studio = studioFor(slug);
  return <StudioLanding
    studio={studio}
    onFindMatch={() => toast("The match quiz is coming next.")}
    onChat={() => toast(`Chat with ${studio.config.receptionistName} is coming soon.`)}
  />;
}
