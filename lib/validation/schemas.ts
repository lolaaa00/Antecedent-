import { z } from "zod";

const HTTPS_URL = z
  .string()
  .max(512)
  .refine((v) => v.startsWith("https://"), "must be an https:// URL")
  .refine((v) => !v.includes("#"), "must not include a fragment")
  .refine((v) => !/:\/\/[^/]*@/.test(v), "must not embed credentials")
  .refine((v) => {
    const host = v.slice("https://".length).split("/")[0]?.toLowerCase() ?? "";
    return !["localhost", "127.0.0.1", "0.0.0.0", "::1"].some(
      (f) => host === f || host.startsWith(f),
    ) && !host.startsWith("10.") && !host.startsWith("192.168.") && !host.startsWith("169.254.");
  }, "must not resolve to a private/local host");

export const eventIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "letters, numbers, dash, underscore only");

export const createEventSchema = z.object({
  eventId: eventIdSchema,
  label: z.string().min(1).max(200),
  criterion: z.string().min(10, "criterion must state a material, checkable condition").max(1000),
  sources: z.array(HTTPS_URL).min(1).max(3),
  timeExtractionPolicy: z.string().min(1).max(300),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const createPairSchema = z
  .object({
    pairId: eventIdSchema,
    eventAId: eventIdSchema,
    eventBId: eventIdSchema,
    relation: z.enum(["BEFORE", "AFTER", "SAME_DAY", "SUPERSEDES"]),
    minSeparationSeconds: z.coerce.number().int().min(0).default(0),
    maxSeparationSeconds: z.coerce.number().int().min(0).default(0),
    sourceIndependencePolicy: z.string().min(1).max(300),
    requireDistinctSourceHosts: z.boolean().default(false),
  })
  .refine((v) => v.eventAId !== v.eventBId, {
    message: "event A and event B must differ",
    path: ["eventBId"],
  })
  .refine((v) => v.maxSeparationSeconds === 0 || v.minSeparationSeconds <= v.maxSeparationSeconds, {
    message: "min separation cannot exceed max separation",
    path: ["maxSeparationSeconds"],
  })
  .refine((v) => v.relation !== "SAME_DAY" || v.minSeparationSeconds < 86400, {
    message: "min separation must be under 86400 seconds for SAME_DAY — no timestamp pair could ever satisfy a full day",
    path: ["minSeparationSeconds"],
  });
export type CreatePairInput = z.infer<typeof createPairSchema>;

export const finalizeCertificateSchema = z.object({
  certificateId: eventIdSchema,
  pairId: eventIdSchema,
});
export type FinalizeCertificateInput = z.infer<typeof finalizeCertificateSchema>;

export const createGateSchema = z.object({
  gateId: eventIdSchema,
  notaryAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a valid address"),
  expectedPairHash: z.string().min(1).max(128),
  requiredRelation: z.enum(["BEFORE", "AFTER", "SAME_DAY", "SUPERSEDES"]),
  minSeparationSeconds: z.coerce.number().int().min(0).default(0),
  maxCertificateAgeSeconds: z.coerce.number().int().min(0).default(0),
});
export type CreateGateInput = z.infer<typeof createGateSchema>;

export const executeGateSchema = z.object({
  gateId: eventIdSchema,
  certificateId: eventIdSchema,
});
export type ExecuteGateInput = z.infer<typeof executeGateSchema>;
