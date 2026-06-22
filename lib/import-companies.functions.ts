import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EnrichSchema } from "./import-companies.schema";
import {
  enrichImportedCompanyForUser,
  getImportErrorMessage,
} from "./import-companies.server";

type EnrichFailureResult = {
  ok: false;
  company: string;
  error: string;
  fit_score: 0;
  jobs_found: 0;
  jobs_out_of_hq: 0;
  execs_found: 0;
};

export const enrichImportedCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => EnrichSchema.parse(d))
  .handler(async ({ data, context }): Promise<Awaited<ReturnType<typeof enrichImportedCompanyForUser>> | EnrichFailureResult> => {
    try {
      return await enrichImportedCompanyForUser(context.userId, data);
    } catch (error) {
      console.error("Company import failed", {
        company: data.company_name,
        error: getImportErrorMessage(error),
      });
      return {
        ok: false,
        company: data.company_name,
        error: getImportErrorMessage(error),
        fit_score: 0,
        jobs_found: 0,
        jobs_out_of_hq: 0,
        execs_found: 0,
      };
    }
  });
