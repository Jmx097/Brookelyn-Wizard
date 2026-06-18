import { createServerFn } from "@tanstack/react-start";
import { EnrichSchema } from "./import-companies.schema";
import {
  enrichImportedCompanyForUser,
  getImportErrorMessage,
} from "./import-companies.server";

const SINGLETON_USER_ID = "00000000-0000-0000-0000-000000000001";

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
  .inputValidator((d) => EnrichSchema.parse(d))
  .handler(async ({ data }): Promise<Awaited<ReturnType<typeof enrichImportedCompanyForUser>> | EnrichFailureResult> => {
    try {
      return await enrichImportedCompanyForUser(SINGLETON_USER_ID, data);
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
