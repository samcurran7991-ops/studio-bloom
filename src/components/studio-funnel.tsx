import * as React from "react";
import { Inbox, TrendingUp, UserRound } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Chip({ selected, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" aria-pressed={selected} className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground", className)} {...props} />;
}

const badgeStyles = cva("inline-flex min-h-7 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-xs font-semibold", { variants: { tone: {
  instagram: "bg-instagram/12 text-instagram", meta: "bg-meta/12 text-meta", google: "bg-google/12 text-google", direct: "bg-direct/12 text-direct",
  new: "bg-primary/12 text-primary", contacted: "bg-waiting/25 text-waiting-foreground", booked: "bg-success/14 text-success", notInterested: "bg-muted text-muted-foreground",
} } });
export function StudioBadge({ tone, children }: { tone: NonNullable<VariantProps<typeof badgeStyles>["tone"]>; children: React.ReactNode }) {
  return <Badge className={badgeStyles({ tone })}>{children}</Badge>;
}

export function UnreadAvatar({ initials = "AL", unread = true }: { initials?: string; unread?: boolean }) {
  return <div className="relative flex size-12 items-center justify-center rounded-full bg-secondary font-display text-lg text-foreground ring-4 ring-background">{initials}{unread && <span className="absolute right-0 top-0 size-3 rounded-full bg-primary ring-2 ring-background" />}</div>;
}

export function EmptyState({ title = "No leads yet", description = "New enquiries will appear here as soon as they arrive." }: { title?: string; description?: string }) {
  return <div className="flex flex-col items-center px-6 py-10 text-center"><div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-primary"><Inbox /></div><h3 className="text-xl">{title}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p><Button variant="secondary" className="mt-5">Add a lead</Button></div>;
}

export function StatTile({ label, value, change }: { label: string; value: string; change?: string }) {
  return <div className="rounded-2xl border bg-card p-5 shadow-soft"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span><TrendingUp className="size-4 text-success" /></div><div className="mt-4 font-display text-4xl">{value}</div>{change && <p className="mt-2 text-xs font-semibold text-success">{change}</p>}</div>;
}

export function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [position, setPosition] = React.useState(52);
  return <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted shadow-soft">
    <img src={after} alt="Healed permanent makeup result" loading="lazy" width={1024} height={768} className="absolute inset-0 size-full object-cover" />
    <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${position}%` }}><img src={before} alt="Before permanent makeup treatment" loading="lazy" width={1024} height={768} className="h-full max-w-none object-cover" style={{ width: "calc((100vw - 48px) * 0.58)", minWidth: "560px" }} /></div>
    <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-card shadow" style={{ left: `${position}%` }}><span className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card text-primary shadow-lift">↔</span></div>
    <span className="absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold">Before</span><span className="absolute bottom-3 right-3 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold">After</span>
    <input aria-label="Compare before and after" type="range" min="5" max="95" value={position} onChange={(event) => setPosition(Number(event.target.value))} className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
  </div>;
}

export function PageShell({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <main className="min-h-screen px-5 py-6 sm:px-10 sm:py-10"><header className="mx-auto flex max-w-6xl items-center justify-between"><a href="/" className="font-display text-xl">Studio Funnel</a><a href="/styleguide" className="flex min-h-11 items-center text-sm font-semibold text-muted-foreground">Style guide</a></header><section className="mx-auto flex min-h-[75vh] max-w-6xl items-center"><div className="max-w-2xl py-20"><p className="mb-5 text-xs font-bold uppercase text-primary">{eyebrow}</p><h1 className="text-5xl leading-[1.04] sm:text-7xl">{title}</h1><p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p><div className="mt-10 flex items-center gap-3"><UnreadAvatar initials="SF" unread={false}/><div><p className="text-sm font-semibold">Foundation ready</p><p className="text-xs text-muted-foreground">Features will live here next.</p></div></div></div></section></main>;
}