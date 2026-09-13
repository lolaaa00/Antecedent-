import { describe, expect, it } from "vitest";
import { createEventSchema, createPairSchema, createGateSchema } from "@/lib/validation/schemas";

const base = {
  eventId: "ev-1",
  label: "Some label",
  criterion: "A material, checkable condition is satisfied.",
  sources: ["https://example.org/a"],
  timeExtractionPolicy: "Use explicit time only.",
};

describe("createEventSchema", () => {
  it("accepts a well-formed event", () => {
    expect(createEventSchema.safeParse(base).success).toBe(true);
  });

  it("rejects non-https sources", () => {
    const result = createEventSchema.safeParse({ ...base, sources: ["http://example.org/a"] });
    expect(result.success).toBe(false);
  });

  it("rejects sources with a fragment", () => {
    const result = createEventSchema.safeParse({ ...base, sources: ["https://example.org/a#x"] });
    expect(result.success).toBe(false);
  });

  it("rejects sources with embedded credentials", () => {
    const result = createEventSchema.safeParse({ ...base, sources: ["https://user:pass@example.org/a"] });
    expect(result.success).toBe(false);
  });

  it("rejects localhost / private hosts", () => {
    for (const url of [
      "https://localhost/a",
      "https://127.0.0.1/a",
      "https://10.0.0.5/a",
      "https://192.168.1.1/a",
    ]) {
      expect(createEventSchema.safeParse({ ...base, sources: [url] }).success).toBe(false);
    }
  });

  it("rejects more than 3 sources", () => {
    const sources = [1, 2, 3, 4].map((i) => `https://example.org/${i}`);
    expect(createEventSchema.safeParse({ ...base, sources }).success).toBe(false);
  });

  it("rejects an empty sources list", () => {
    expect(createEventSchema.safeParse({ ...base, sources: [] }).success).toBe(false);
  });

  it("rejects an event id with invalid characters", () => {
    expect(createEventSchema.safeParse({ ...base, eventId: "not valid!" }).success).toBe(false);
  });
});

describe("createPairSchema", () => {
  const pairBase = {
    pairId: "pair-1",
    eventAId: "a",
    eventBId: "b",
    relation: "BEFORE" as const,
    minSeparationSeconds: 0,
    maxSeparationSeconds: 0,
    sourceIndependencePolicy: "distinct domains",
  };

  it("accepts a well-formed pair", () => {
    expect(createPairSchema.safeParse(pairBase).success).toBe(true);
  });

  it("rejects when event A and B are the same", () => {
    const result = createPairSchema.safeParse({ ...pairBase, eventBId: "a" });
    expect(result.success).toBe(false);
  });

  it("rejects when min separation exceeds max separation", () => {
    const result = createPairSchema.safeParse({
      ...pairBase,
      minSeparationSeconds: 100,
      maxSeparationSeconds: 10,
    });
    expect(result.success).toBe(false);
  });

  it("allows max separation of 0 to mean unbounded regardless of min", () => {
    const result = createPairSchema.safeParse({
      ...pairBase,
      minSeparationSeconds: 100,
      maxSeparationSeconds: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("createGateSchema", () => {
  it("rejects a malformed notary address", () => {
    const result = createGateSchema.safeParse({
      gateId: "g1",
      notaryAddress: "not-an-address",
      expectedPairHash: "abc123",
      requiredRelation: "BEFORE",
      minSeparationSeconds: 0,
      maxCertificateAgeSeconds: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed gate", () => {
    const result = createGateSchema.safeParse({
      gateId: "g1",
      notaryAddress: "0x1111111111111111111111111111111111111111",
      expectedPairHash: "abc123",
      requiredRelation: "BEFORE",
      minSeparationSeconds: 0,
      maxCertificateAgeSeconds: 0,
    });
    expect(result.success).toBe(true);
  });
});
