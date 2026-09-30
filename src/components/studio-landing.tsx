import * as React from "react";
import { Clock, Heart, Instagram, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, Star, Droplet, Camera, Award } from "lucide-react";
import type { Service, Studio } from "@/engine/types";
import { money } from "@/engine/quiz";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BeforeAfterSlider, Chip } from "@/components/studio-funnel";
import { cn } from "@/lib/utils";

type Group = Service["group"];
const GROUPS: { key: Group; label: string; reviewTag: string }[] = [
  { key: "brows", label: "Brows", reviewTag: "Brows client" },
  { key: "lips", label: "Lips", reviewTag: "Lip blush client" },
  { key: "eyes", label: "Eyes", reviewTag: "Lash line client" },
  { key: "fix", label: "Corrections", reviewTag: "Correction client" },
];

interface Actions { onFindMatch: () => void; onChat: () => void }

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{children}</p>;
}
function SectionHead({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return <div className="max-w-2xl"><Eyebrow>{eyebrow}</Eyebrow><h2 className="mt-3 font-display text-3xl leading-tight text-foreground sm:text-4xl">{title}</h2>{intro && <p className="mt-4 leading-7 text-muted-foreground">{intro}</p>}</div>;
}
const Section = ({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) =>
  <section id={id} className={cn("scroll-mt-20 px-5 py-16 sm:px-10 sm:py-24", className)}><div className="mx-auto max-w-6xl">{children}</div></section>;

function Rating({ studio, className }: { studio: Studio; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 text-sm text-muted-foreground", className)}>
    <Star aria-hidden className="size-4 fill-waiting text-waiting" /><span className="font-semibold text-foreground">{studio.config.rating}</span>
    <span>· {studio.config.reviewCount} reviews</span>
  </span>;
}

export function StudioHeader({ studio, onChat }: { studio: Studio; onChat: () => void }) {
  const c = studio.config;
  return <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 sm:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm text-primary-foreground">{c.initials}</span>
        <div className="min-w-0">
          <p className="truncate font-display text-base leading-tight text-foreground sm:text-lg">{c.name}</p>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><span className="truncate">{c.city}</span><span aria-hidden>·</span><Rating studio={studio} className="shrink-0 text-xs [&_svg]:size-3" /></p>
        </div>
      </div>
      <Button variant="secondary" onClick={onChat} className="shrink-0 px-3 sm:px-4" aria-label={`Chat with ${c.receptionistName}`}>
        <MessageCircle aria-hidden /><span className="hidden sm:inline">Chat with {c.receptionistName}</span><span className="sm:hidden">{c.receptionistName}</span>
      </Button>
    </div>
  </header>;
}

function Hero({ studio, onFindMatch }: { studio: Studio; onFindMatch: () => void }) {
  const c = studio.config;
  return <Section className="pt-10 sm:pt-16">
    <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
      <div>
        <Eyebrow>{c.artist.title} · {c.city}</Eyebrow>
        <h1 className="mt-5 font-display text-[2.6rem] leading-[1.06] text-foreground sm:text-6xl">{c.artist.name}: natural brows and lips that heal beautifully</h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Answer four quick questions and we'll suggest the treatment that suits your face, skin and routine, with the price up front.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={onFindMatch} className="px-7">Find my match · 30 sec</Button>
          <Button size="lg" variant="quiet" asChild><a href="#services">See prices</a></Button>
        </div>
        <div className="mt-8"><Rating studio={studio} /></div>
      </div>
      <figure className="relative">
        <div className="flex aspect-[4/5] items-end rounded-[20px] bg-secondary p-6 shadow-soft">
          <div className="absolute inset-6 rounded-2xl border border-dashed border-muted-foreground/30" aria-hidden />
          <figcaption className="relative rounded-2xl bg-card/90 px-4 py-3 text-sm shadow-soft">
            <p className="font-display text-base text-foreground">{c.artist.name}</p>
            <p className="text-muted-foreground">Artist photo goes here</p>
          </figcaption>
        </div>
      </figure>
    </div>
  </Section>;
}

function TrustRow({ studio }: { studio: Studio }) {
  const items = [
    { icon: ShieldCheck, label: "Licensed & insured" },
    { icon: Sparkles, label: "Touch-up included" },
    { icon: Droplet, label: "Numbing used" },
    { icon: Award, label: `${studio.config.artist.years} years experience` },
    { icon: Camera, label: "Healed results shown" },
  ];
  return <div className="border-y border-border/70 bg-card/60 px-5 py-6 sm:px-10">
    <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ icon: Icon, label }) => <li key={label} className="flex items-center gap-2.5 text-sm font-semibold text-foreground"><Icon aria-hidden className="size-5 shrink-0 text-success" />{label}</li>)}
    </ul>
  </div>;
}

function Gallery() {
  const [group, setGroup] = React.useState<Group>("brows");
  const label = GROUPS.find((g) => g.key === group)!.label;
  return <Section id="results">
    <SectionHead eyebrow="Healed results" title="Photographed after healing, not on the day" intro="Fresh work always looks darker. These show how it settles once healed. Drag the handle to compare." />
    <div role="group" aria-label="Choose a treatment" className="mt-8 flex flex-wrap gap-2">
      {GROUPS.map((g) => <Chip key={g.key} selected={group === g.key} onClick={() => setGroup(g.key)}>{g.label}</Chip>)}
    </div>
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((n) => <figure key={`${group}-${n}`} className={cn(n === 3 && "hidden lg:block")}>
        <BeforeAfterSlider label={`${label} result ${n}: compare before and healed`} />
        <figcaption className="mt-3 text-sm text-muted-foreground">{label} · healed at 8 weeks</figcaption>
      </figure>)}
    </div>
  </Section>;
}

function HowItWorks() {
  const steps = [
    { t: "Find your match", d: "Four quick questions about your goals, your skin and what worries you. You'll see the treatment and price that fit." },
    { t: "Consult & design", d: "We draw the shape and choose the colour with you. Nothing is tattooed until you love it in the mirror." },
    { t: "Heal and perfect", d: "About a week of gentle healing. Your touch-up at 6–8 weeks is included to perfect the result." },
  ];
  return <Section className="bg-secondary/50">
    <SectionHead eyebrow="How it works" title="Three calm steps, no pressure" />
    <ol className="mt-10 grid gap-5 md:grid-cols-3">
      {steps.map((s, i) => <li key={s.t} className="rounded-[20px] bg-card p-7 shadow-soft">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-display text-lg text-primary">{i + 1}</span>
        <h3 className="mt-5 font-display text-xl text-foreground">{s.t}</h3>
        <p className="mt-2 leading-7 text-muted-foreground">{s.d}</p>
      </li>)}
    </ol>
  </Section>;
}

function Services({ studio, onFindMatch }: Actions & { studio: Studio }) {
  return <Section id="services">
    <SectionHead eyebrow="Services & prices" title="Clear prices, touch-up included" intro={`A ${money(studio.config.deposit)} deposit holds your time and comes off the total.`} />
    <div className="mt-10 space-y-12">
      {GROUPS.map((g) => {
        const list = studio.config.services.filter((s) => s.group === g.key);
        if (!list.length) return null;
        return <div key={g.key}>
          <h3 className="font-display text-xl text-foreground">{g.label}</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {list.map((s) => <article key={s.key} className="flex flex-col rounded-[20px] border border-border/70 bg-card p-6 shadow-soft">
              <div className="flex items-baseline justify-between gap-4">
                <h4 className="min-w-0 font-display text-lg text-foreground">{s.name}</h4>
                <p className="shrink-0 font-display text-2xl text-primary">{money(s.price)}</p>
              </div>
              <p className="mt-3 flex-1 leading-7 text-muted-foreground">{s.why}</p>
              <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-border/70 pt-4 text-sm">
                <div className="flex gap-1.5"><dt className="text-muted-foreground">Session</dt><dd className="font-semibold text-foreground">{s.duration}</dd></div>
                <div className="flex gap-1.5"><dt className="text-muted-foreground">Lasts</dt><dd className="font-semibold text-foreground">{s.lasts}</dd></div>
              </dl>
            </article>)}
          </div>
        </div>;
      })}
    </div>
    <div className="mt-12 flex flex-col items-start gap-3 rounded-[20px] bg-secondary/60 p-7 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-display text-xl text-foreground">Not sure which one is right for you?</p>
      <Button onClick={onFindMatch}>Find my match · 30 sec</Button>
    </div>
  </Section>;
}

function Reviews({ studio }: { studio: Studio }) {
  const r = studio.config.reviews;
  const quotes = [...GROUPS.map((g) => ({ text: r[g.key], who: g.reviewTag })), { text: r["any"], who: "First-time client" }].filter((q) => q.text);
  return <Section className="bg-secondary/50">
    <SectionHead eyebrow="Reviews" title="In our clients' words" />
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {quotes.map((q, i) => <figure key={i} className={cn("rounded-[20px] bg-card p-7 shadow-soft", i === 4 && "sm:col-span-2 lg:col-span-1")}>
        <div className="flex gap-0.5" aria-label="5 stars">{Array.from({ length: 5 }).map((_, j) => <Star key={j} aria-hidden className="size-4 fill-waiting text-waiting" />)}</div>
        <blockquote className="mt-4 font-display text-lg leading-8 text-foreground">“{q.text}”</blockquote>
        <figcaption className="mt-4 text-sm text-muted-foreground">{q.who}</figcaption>
      </figure>)}
    </div>
  </Section>;
}

function Artist({ studio, onChat }: { studio: Studio; onChat: () => void }) {
  const a = studio.config.artist;
  return <Section>
    <div className="grid items-center gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
      <div className="flex aspect-square items-center justify-center rounded-[20px] bg-secondary shadow-soft"><span className="font-display italic text-muted-foreground">Portrait of {a.name}</span></div>
      <div>
        <Eyebrow>Your artist</Eyebrow>
        <h2 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">Meet {a.name}</h2>
        <p className="mt-2 text-muted-foreground">{a.title} · {a.years} years</p>
        <p className="mt-6 text-lg leading-8 text-foreground">{a.bio}</p>
        <Button variant="secondary" className="mt-8" onClick={onChat}><Heart aria-hidden />Ask a question first</Button>
      </div>
    </div>
  </Section>;
}

function Faq({ studio }: { studio: Studio }) {
  return <Section className="bg-secondary/50">
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
      <SectionHead eyebrow="Questions" title="The things everyone wonders" intro="Honest answers about pain, healing and looking natural." />
      <Accordion type="single" collapsible className="rounded-[20px] bg-card px-6 shadow-soft">
        {studio.config.faqs.map((f) => <AccordionItem key={f.id} value={f.id} className="border-border/70 last:border-0">
          <AccordionTrigger className="min-h-14 text-left font-display text-lg text-foreground hover:no-underline">{f.q}</AccordionTrigger>
          <AccordionContent className="text-base leading-7 text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>)}
      </Accordion>
    </div>
  </Section>;
}

function Footer({ studio }: { studio: Studio }) {
  const c = studio.config;
  const ig = c.instagram.replace(/^@/, "");
  const rows = [
    { icon: MapPin, content: c.address },
    { icon: Clock, content: c.hours },
    { icon: Phone, content: <a className="underline-offset-4 hover:underline" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a> },
    { icon: Instagram, content: <a className="underline-offset-4 hover:underline" href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">{c.instagram}</a> },
  ];
  return <footer className="px-5 pb-32 pt-16 sm:px-10 md:pb-16">
    <div className="mx-auto grid max-w-6xl gap-10 border-t border-border/70 pt-12 md:grid-cols-2">
      <div><p className="font-display text-2xl text-foreground">{c.name}</p><p className="mt-2 text-muted-foreground">{c.city}</p></div>
      <ul className="space-y-3 text-sm text-foreground">
        {rows.map(({ icon: Icon, content }, i) => <li key={i} className="flex items-center gap-3"><Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words">{content}</span></li>)}
      </ul>
    </div>
  </footer>;
}

function StickyMatchBar({ onFindMatch }: { onFindMatch: () => void }) {
  return <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
    <Button size="lg" className="w-full" onClick={onFindMatch}>Find my match · 30 sec</Button>
  </div>;
}

export function StudioLanding({ studio, onFindMatch, onChat }: Actions & { studio: Studio }) {
  return <div className="min-h-screen bg-background text-foreground">
    <StudioHeader studio={studio} onChat={onChat} />
    <main>
      <Hero studio={studio} onFindMatch={onFindMatch} />
      <TrustRow studio={studio} />
      <Gallery />
      <HowItWorks />
      <Services studio={studio} onFindMatch={onFindMatch} onChat={onChat} />
      <Reviews studio={studio} />
      <Artist studio={studio} onChat={onChat} />
      <Faq studio={studio} />
    </main>
    <Footer studio={studio} />
    <StickyMatchBar onFindMatch={onFindMatch} />
  </div>;
}
