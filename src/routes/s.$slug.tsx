import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import type { QuizAnswers, Studio } from "@/engine/types";
import { serviceByKey } from "@/engine/quiz";
import { StudioHeader, StudioLanding } from "@/components/studio-landing";
import { MatchQuiz, MatchResult, type ResultAction } from "@/components/studio-quiz";
import { Button } from "@/components/ui/button";
import { studioQueryOptions, trackStep, useStudioVisit } from "@/lib/studio";

export const Route = createFileRoute("/s/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(studioQueryOptions(params.slug)),
  head: ({ loaderData }) => {
    const c = loaderData?.config;
    const title = c ? `${c.name} — Natural brows & lips that heal beautifully` : "Studio page not found";
    const description = c ? `Find your permanent makeup match in 30 seconds, see clear prices and meet ${c.artist.name} at ${c.name}.` : "This studio page doesn't exist.";
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  errorComponent: () => <Missing title="This page didn't load" body="Please refresh in a moment." />,
  notFoundComponent: () => <Missing />,
  component: StudioPage,
});

function Missing({ title = "This studio page doesn't exist", body = "The link may be mistyped, or the studio may have changed its address." }: { title?: string; body?: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-background px-5">
    <div className="max-w-md rounded-[20px] bg-card p-8 text-center shadow-soft">
      <h1 className="font-display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 leading-7 text-muted-foreground">{body}</p>
      <Button asChild className="mt-6"><Link to="/">Go to the home page</Link></Button>
    </div>
  </main>;
}

type View = { name: "landing" } | { name: "quiz" } | { name: "result" } | { name: "action"; action: ResultAction };
const ACTION_TITLES: Record<ResultAction, string> = { booking: "Request a time", consult: "Book a free 15-min consult", lead: "Send me the price", question: "Ask a question" };

function StudioPage() {
  const { slug } = Route.useParams();
  const { data: studio } = useSuspenseQuery(studioQueryOptions(slug));
  useStudioVisit(studio);
  if (!studio) return <Missing />;
  return <Funnel studio={studio} />;
}

function Funnel({ studio }: { studio: Studio }) {
  const [view, setView] = React.useState<View>({ name: "landing" });
  const [answers, setAnswers] = React.useState<QuizAnswers | null>(null);
  const chat = () => toast(`Chat with ${studio.config.receptionistName} is coming soon.`);
  React.useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);

  if (view.name === "landing") return <StudioLanding studio={studio} onFindMatch={() => setView({ name: "quiz" })} onChat={chat} />;

  return <div className="min-h-screen bg-background text-foreground">
    <StudioHeader studio={studio} onChat={chat} />
    <main>
      {view.name === "quiz" && <MatchQuiz studio={studio} onStart={() => trackStep(studio, "quiz_start")} onExit={() => setView({ name: "landing" })}
        onDone={(a) => { setAnswers(a); trackStep(studio, "quiz_done"); setView({ name: "result" }); }} />}
      {view.name === "result" && answers && <MatchResult studio={studio} answers={answers} onRetake={() => setView({ name: "quiz" })} onAction={(action) => setView({ name: "action", action })} />}
      {view.name === "action" && <div className="mx-auto max-w-xl px-5 pb-16 pt-6">
        <Button variant="quiet" onClick={() => setView(answers ? { name: "result" } : { name: "landing" })}><ArrowLeft aria-hidden />Back</Button>
        <h1 className="mt-6 font-display text-3xl text-foreground">{view.action === "booking" && answers ? `Request ${serviceByKey(studio.config, answers.match)?.name}` : ACTION_TITLES[view.action]}</h1>
        <p className="mt-3 leading-7 text-muted-foreground">This form is coming in the next step.</p>
      </div>}
    </main>
  </div>;
}
