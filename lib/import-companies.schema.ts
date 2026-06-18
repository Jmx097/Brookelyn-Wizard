import { z } from "zod";

export const EnrichSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  website: z.string().trim().max(500).optional().nullable(),
});

export type EnrichInput = z.infer<typeof EnrichSchema>;
