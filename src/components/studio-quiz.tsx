import * as React from "react";
import { ArrowLeft, Check, Clock, Droplet, Eye, Heart, MessageCircle, PenLine, RotateCcw, Sparkles, Star, CalendarHeart, Send, Hourglass } from "lucide-react";
import type { QuizAnswers, Studio } from "@/engine/types";
import { CONDITIONS, GOALS, LOOKS, Q2, Q3, WORRIES, matchService, money, serviceByKey } from "@/engine/quiz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GOAL_ICONS: Record<string, React.ElementType> = { brows: PenLine, lips: Heart, eyes: Eye, fix: RotateCcw };
const OPTION_ICONS = [Sparkles, Droplet, Star, Heart];

function OptionCard({ icon: Icon, title, hint, selected, multi, onClick }: { icon: React.ElementType; title: string; hint?: string; selected?: boolean; multi?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={selected}
    className={cn("flex min-h-16 w-full items-center gap-4 rounded-[18px] border bg-card p-4 text-left shadow-soft transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
      selected ? "border-primary ring-1 ring-primary" : "border-border/70")}>
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}>
      {selected && multi ? <Check aria-hidden className="size-5" /> : <Icon aria-hidden className="size-5" />}
    </span>
    <span className="min-w-0">
      <span className="block font-display text-lg leading-snug text-foreground">{title}</span>
      {hint && <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>}
    </span>
  </button>;
}

export function MatchQuiz({ studio, onExit, onDone, onStart }: { studio: Studio; onExit: () => void; onDone: (a: QuizAnswers) => void; onStart: () => void }) {
  const [step, setStep] = React.useState(0);
  const [a, setA] = React.useState<QuizAnswers>({ worries: [] });
  const started = React.useRef(false);
  const goal = a.goal ?? "";

  const answer = (patch: Partial<QuizAnswers>) => {
    if (!started.current) { started.current = true; onStart(); }
    setA((prev) => {
      const next = { ...prev, ...patch };
      if (patch.goal && patch.goal !== prev.goal) { delete next.cond; delete next.look; }
      return next;
    });
    setStep((s) => s + 1);
  };
  const toggleWorry = (id: string) => {
    if (!started.current) { started.current = true; onStart(); }
    setA((p) => ({ ...p, worries: p.worries?.includes(id) ? p.worries.filter((w) => w !== id) : [...(p.worries ?? []), id] }));
  };
  const back = () => (step === 0 ? onExit() : setStep((s) => s - 1));
  const finish = () => onDone({ ...a, worries: a.worries ?? [], match: matchService(a) });

  let heading: string = "", body: React.ReactNode = null;
  if (step === 0) {
    heading = "What would you like to enhance?";
    body = GOALS.map(([id, t, h]) => <OptionCard key={id} icon={GOAL_ICONS[id] ?? Sparkles} title={t} hint={h} selected={a.goal === id} onClick={() => answer({ goal: id })} />);
  } else if (step === 1) {
    heading = Q2[goal] ?? "";
    body = (CONDITIONS[goal] ?? []).map(([id, t], i) => <OptionCard key={id} icon={OPTION_ICONS[i % 4] ?? Sparkles} title={t} selected={a.cond === id} onClick={() => answer({ cond: id })} />);
  } else if (step === 2) {
    heading = Q3[goal] ?? "";
    body = (LOOKS[goal] ?? []).map(([id, t, h], i) => <OptionCard key={id} icon={OPTION_ICONS[i % 4] ?? Sparkles} title={t} hint={h} selected={a.look === id} onClick={() => answer({ look: id })} />);
  } else {
    heading = "Anything you're worried about?";
    body = WORRIES.map(([id, t], i) => <OptionCard key={id} multi icon={OPTION_ICONS[i % 4] ?? Sparkles} title={t} selected={a.worries?.includes(id)} onClick={() => toggleWorry(id)} />);
  }

  return <div className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-xl flex-col px-5 pb-10 pt-4 sm:px-6">
    <div className="flex items-center gap-3">
      <Button variant="quiet" size="icon" onClick={back} aria-label={step === 0 ? "Back to the studio page" : "Previous question"}><ArrowLeft aria-hidden /></Button>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label={`Question ${step + 1} of 4`}>
        <div className="h-full rounded-full bg-primary transition-all duration-500 motion-reduce:transition-none" style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </div>
      <span className="w-10 text-right text-sm text-muted-foreground">{step + 1}/4</span>
    </div>
    <div key={step} className="mt-8 flex-1 animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none">
      <h1 className="font-display text-3xl leading-tight text-foreground sm:text-4xl">{heading}</h1>
      {step === 3 && <p className="mt-2 text-muted-foreground">Pick any that apply. We'll answer them honestly.</p>}
      <div className="mt-7 grid gap-3">{body}</div>
    </div>
    {step === 3 && <Button size="lg" className="mt-8 w-full" onClick={finish}>Show my match</Button>}
  </div>;
}

const HEALING = [
  { when: "Days 1–3", what: "Looks darker and bolder than the final result. Totally normal." },
  { when: "Days 4–10", what: "Light flaking. Let it fall off on its own, no picking." },
  { when: "Weeks 2–4", what: "Colour settles and softens as the skin fully heals." },
  { when: "Weeks 6–8", what: "Your included touch-up perfects shape and colour." },
];

export type ResultAction = "booking" | "consult" | "lead" | "question";

export function MatchResult({ studio, answers, onAction, onRetake }: { studio: Studio; answers: QuizAnswers; onAction: (a: ResultAction) => void; onRetake: () => void }) {
  const c = studio.config;
  const s = serviceByKey(c, answers.match)!;
  const worries = (answers.worries ?? []).map((id) => ({ id, label: WORRIES.find((w) => w[0] === id)?.[1], faq: c.faqs.find((f) => f.id === id) })).filter((w) => w.faq);
  const review = c.reviews[answers.goal ?? ""] || c.reviews["any"];

  return <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 sm:px-6 animate-in fade-in duration-500 motion-reduce:animate-none">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your match</p>
    <h1 className="mt-3 font-display text-4xl leading-tight text-foreground sm:text-5xl">{s.name}</h1>
    <section className="mt-6 rounded-[20px] bg-card p-6 shadow-soft">
      <p className="font-display text-3xl text-primary">{money(s.price)}</p>
      <p className="mt-1 text-sm text-muted-foreground">Touch-up included · {money(c.deposit)} deposit comes off the total</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border/70 pt-5 text-sm">
        <div><dt className="flex items-center gap-1.5 text-muted-foreground"><Clock aria-hidden className="size-4" />Session</dt><dd className="mt-1 font-semibold text-foreground">{s.duration}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-muted-foreground"><Hourglass aria-hidden className="size-4" />Lasts</dt><dd className="mt-1 font-semibold text-foreground">{s.lasts}</dd></div>
      </dl>
      <h2 className="mt-6 font-display text-lg text-foreground">Why it suits you</h2>
      <p className="mt-2 leading-7 text-muted-foreground">{s.why}</p>
    </section>

    <section className="mt-10">
      <h2 className="font-display text-2xl text-foreground">What healing looks like</h2>
      <ol className="mt-5 space-y-0">
        {HEALING.map((h, i) => <li key={h.when} className="relative flex gap-4 pb-6 last:pb-0">
          {i < HEALING.length - 1 && <span aria-hidden className="absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-px bg-border" />}
          <span aria-hidden className="mt-1 size-6 shrink-0 rounded-full border-2 border-primary bg-background" />
          <div><p className="font-semibold text-foreground">{h.when}</p><p className="mt-1 leading-7 text-muted-foreground">{h.what}</p></div>
        </li>)}
      </ol>
    </section>

    {worries.length > 0 && <section className="mt-10">
      <h2 className="font-display text-2xl text-foreground">Your questions, answered</h2>
      <div className="mt-5 space-y-3">
        {worries.map((w) => <div key={w.id} className="rounded-[18px] bg-secondary/60 p-5">
          <p className="font-semibold text-foreground">{w.label}</p>
          <p className="mt-2 leading-7 text-muted-foreground">{w.faq!.a}</p>
        </div>)}
      </div>
    </section>}

    {review && <figure className="mt-10 rounded-[20px] bg-card p-6 shadow-soft">
      <div className="flex gap-0.5" aria-label="5 stars">{Array.from({ length: 5 }).map((_, j) => <Star key={j} aria-hidden className="size-4 fill-waiting text-waiting" />)}</div>
      <blockquote className="mt-3 font-display text-lg leading-8 text-foreground">“{review}”</blockquote>
      <figcaption className="mt-3 text-sm text-muted-foreground">A {c.name} client</figcaption>
    </figure>}

    <div className="mt-10 grid gap-3">
      <Button size="lg" onClick={() => onAction("booking")}><CalendarHeart aria-hidden />Request {s.name}</Button>
      <Button size="lg" variant="secondary" onClick={() => onAction("consult")}>Book a free 15-min consult</Button>
      <Button size="lg" variant="quiet" onClick={() => onAction("lead")}><Send aria-hidden />Not ready? Send me the price</Button>
      <Button size="lg" variant="quiet" onClick={() => onAction("question")}><MessageCircle aria-hidden />Ask a question</Button>
    </div>
    <button type="button" onClick={onRetake} className="mx-auto mt-6 block min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline">Retake the quiz</button>
  </div>;
}
