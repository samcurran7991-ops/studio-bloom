import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { Studio } from "@/engine/types";

// Public studio lookup for /s/:slug. Visitors only ever reach get_public_studio.
export const getPublicStudio = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(60) }).parse(data))
  .handler(async ({ data }): Promise<Studio | null> => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: row, error } = await sb.rpc("get_public_studio", { p_slug: data.slug });
    if (error) throw new Error("Could not load this studio right now");
    return (row as unknown as Studio | null) ?? null;
  });
