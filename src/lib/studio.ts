import { queryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import { DEMO_STUDIO } from "@/engine/demoStudio";
import { getVisit } from "@/engine/tracking";
import type { FunnelStep, Studio } from "@/engine/types";
import { supabase } from "@/integrations/supabase/client";
import { getPublicStudio } from "./studio.functions";

/** Slugs that show the built-in example studio when no real studio owns them. */
const DEMO_SLUGS = new Set(["demo", DEMO_STUDIO.slug]);

export const isDemoStudio = (s: Studio) => s.id === DEMO_STUDIO.id;

export const studioQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["public-studio", slug],
    queryFn: async (): Promise<Studio | null> => {
      const studio = await getPublicStudio({ data: { slug } });
      if (studio) return studio;
      return DEMO_SLUGS.has(slug) ? DEMO_STUDIO : null;
    },
    staleTime: 60_000,
  });

/** Records a funnel step once per visit (browser only). No-op for the demo studio. */
export function trackStep(studio: Studio, step: FunnelStep) {
  if (typeof window === "undefined" || isDemoStudio(studio)) return;
  const visit = getVisit();
  const key = `sf-step:${studio.slug}:${visit.sessionId}:${step}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch { /* storage blocked: still send */ }
  void supabase.rpc("track_step", {
    p_slug: studio.slug,
    p_session: visit.sessionId,
    p_source: visit.source,
    p_step: step,
  });
}

/** Call on the studio page: works out the visit source and records `visit`. */
export function useStudioVisit(studio: Studio | null) {
  useEffect(() => {
    if (studio) trackStep(studio, "visit");
  }, [studio]);
}
