import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/studio-funnel";
import { Button } from "@/components/ui/button";
import { studioQueryOptions, useStudioVisit } from "@/lib/studio";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ context, params }) => {
    const studio = await context.queryClient.ensureQueryData(studioQueryOptions(params.slug));
    if (!studio) throw notFound();
    return { name: studio.config.name, city: studio.config.city };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Studio not found" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.name} — Find your permanent makeup match`;
    const description = `Take the 1-minute match quiz, see prices and request a time at ${loaderData.name}.`;
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
  notFoundComponent: StudioNotFound,
  errorComponent: StudioError,
  component: StudioPage,
});

function StudioPage() {
  const { slug } = Route.useParams();
  const { data: studio } = useSuspenseQuery(studioQueryOptions(slug));
  useStudioVisit(studio);
  if (!studio) return <StudioNotFound />;
  return (
    <PageShell
      eyebrow={studio.config.city}
      title={studio.config.name}
      description={`With ${studio.config.artist.name}. The landing page, match quiz and booking forms come next.`}
    />
  );
}

function StudioNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-3xl text-foreground">This studio page doesn't exist</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The link may have a typo, or the studio has changed its page address.
        </p>
        <Button asChild className="mt-6"><Link to="/">Go to Studio Funnel</Link></Button>
      </div>
    </main>
  );
}

function StudioError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-3xl text-foreground">We couldn't load this page</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">Please refresh in a moment.</p>
      </div>
    </main>
  );
}
