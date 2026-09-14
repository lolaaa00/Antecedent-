export type EventStatus = "DRAFT" | "SEALED" | "OBSERVED" | "INCONCLUSIVE" | "UNAVAILABLE";
export type Relation = "BEFORE" | "AFTER" | "SAME_DAY" | "SUPERSEDES";
export type CertificateStatus = "VALID" | "INCONCLUSIVE" | "UNAVAILABLE" | "INVALID_RELATION";
export type Occurrence = "CONFIRMED" | "NOT_CONFIRMED" | "INCONCLUSIVE" | "UNAVAILABLE";
export type TimeBasis = "EXPLICIT_SOURCE_TIME" | "PAGE_DATE" | "UNKNOWN";

export type SourceSupport = {
  source_id: number;
  stance: "SUPPORTS" | "CONTRADICTS" | "UNCLEAR";
  excerpt: string;
  canonical_url: string;
  content_digest: string;
  context_digest: string;
};

export type Observation = {
  occurrence: Occurrence | "";
  effective_time: string;
  time_basis: TimeBasis | "";
  reason: string;
  source_support: SourceSupport[];
  evidence_hash: string;
};

export type EventRecord = {
  event_id: string;
  label: string;
  criterion: string;
  sources: string[];
  time_extraction_policy: string;
  definition_hash: string;
  status: EventStatus;
  creator: string;
  observation: Observation;
};

export type PairRecord = {
  pair_hash: string;
  event_a_id: string;
  event_b_id: string;
  event_a_definition_hash: string;
  event_b_definition_hash: string;
  relation: Relation;
  min_separation_seconds: number;
  max_separation_seconds: number;
  source_independence_policy: string;
  require_distinct_source_hosts: boolean;
  creator: string;
  created_at: number;
};

export type CertificateRecord = {
  certificate_id: string;
  pair_hash: string;
  event_a_id: string;
  event_b_id: string;
  event_a_definition_hash: string;
  event_b_definition_hash: string;
  event_a_observation: Observation;
  event_b_observation: Observation;
  final_relation: string;
  separation_seconds: number;
  finalized_timestamp: number;
  status: CertificateStatus;
  supersedes_commitment: string;
  certificate_hash: string;
};

export type GateRule = {
  gate_id: string;
  notary_address: string;
  expected_pair_hash: string;
  required_relation: Relation;
  min_separation_seconds: number;
  max_certificate_age_seconds: number;
  status: "ARMED" | "EXECUTED";
  creator: string;
  created_at: number;
};

export type ExecutionReceipt = {
  gate_id: string;
  certificate_id: string;
  executed_at: number;
  executor: string;
  receipt_hash: string;
};

export type PublishedNotice = {
  gate_id: string;
  certificate_id: string;
  notice: string;
  published_at: number;
  publisher: string;
};
