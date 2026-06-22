import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RouteInputSchema = z.object({
  destinationAddress: z.string().trim().email().max(320),
  sourceLabel: z.string().trim().max(120).optional().nullable(),
});

function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export const listInboundEmailRoutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("inbound_email_routes")
      .select("id,user_id,route_key,destination_address,source_label,is_active,created_at,updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createInboundEmailRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => RouteInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const routeKey = normalizeEmailAddress(data.destinationAddress);
    const { data: created, error } = await supabaseAdmin
      .from("inbound_email_routes")
      .insert({
        user_id: context.userId,
        route_key: routeKey,
        destination_address: routeKey,
        source_label: data.sourceLabel?.trim() || null,
        is_active: true,
      })
      .select("id,user_id,route_key,destination_address,source_label,is_active,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deactivateInboundEmailRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ routeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await supabaseAdmin
      .from("inbound_email_routes")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", data.routeId)
      .eq("user_id", context.userId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });
