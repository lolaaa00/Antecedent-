# Contract surface

## `AntecedentNotary` (`contracts/antecedent_notary.py`)

| Method | Kind | Notes |
|---|---|---|
| `create_event(event_id, label, criterion, sources, time_extraction_policy)` | write | `DRAFT`. Validates bounds + URL hardening. |
| `seal_event(event_id)` | write | Creator-only. `DRAFT → SEALED`. Irreversible. |
| `observe_event(event_id)` | write | Requires `SEALED`. Runs leader/validator consensus with exact-match, fail-closed comparison (see [CONSENSUS.md](CONSENSUS.md)). `SEALED → OBSERVED\|INCONCLUSIVE\|UNAVAILABLE`. One-shot. |
| `create_pair(pair_id, event_a_id, event_b_id, relation, min_separation_seconds, max_separation_seconds, source_independence_policy, require_distinct_source_hosts)` | write | Both events must be sealed (or further along). Rejects an impossible `SAME_DAY` bound (`min_separation_seconds >= 86400`). If `require_distinct_source_hosts` is `True`, rejects the pair outright when event A and event B share any canonical source host. Immutable from creation; `pair_hash` binds both events' `definition_hash` plus every other field. |
| `finalize_certificate(certificate_id, pair_id)` | write | Requires both events observed for a temporal relation, re-validates definition hashes against the pair, derives relation deterministically with UTC-normalized timestamps (or runs the SUPERSEDES semantic round). One-shot per `certificate_id`. |
| `get_event(event_id)` / `get_pair(pair_id)` / `get_certificate(certificate_id)` | view | Raise on unknown id. |
| `list_event_ids()` / `list_pair_ids()` | view | For frontend enumeration. |

### Event statuses
`DRAFT → SEALED → {OBSERVED | INCONCLUSIVE | UNAVAILABLE}` (terminal).

### Certificate statuses
`VALID | INCONCLUSIVE | UNAVAILABLE | INVALID_RELATION` (all terminal —
certificates are never mutated after `finalize_certificate` returns).

### `SourceSupport` (per-source evidence, stored on every `Observation`)
`source_id`, `stance`, `excerpt`, `canonical_url`, `content_digest` (SHA-256
of the full fetched body), `context_digest` (SHA-256 of the bounded excerpt
actually handed to the model — equal to `content_digest` only when nothing
was truncated). See [CONSENSUS.md](CONSENSUS.md) for how these digests are
computed and compared, and [SECURITY.md](SECURITY.md) for exactly what they
do and do not prove.

### Certificate commitment
`certificate_hash = sha256("cert-v2", pair_hash, event_a_definition_hash,
event_b_definition_hash, event_a_observation.evidence_hash,
event_b_observation.evidence_hash, final_relation, status,
separation_seconds, supersedes_commitment)`, where each observation's
`evidence_hash` is itself `sha256("obs-v2", occurrence, effective_time,
time_basis, <source_id, stance, content_digest, context_digest> for every
source, sorted by source_id)`. Every input is stored on-chain and readable
via `get_certificate` / `get_pair`, so a verifier can recompute this hash
independently — see `tests/contract/test_notary.py::test_certificate_commitment_is_reproducible`.

## `AntecedentGate` (`contracts/antecedent_gate.py`)

| Method | Kind | Notes |
|---|---|---|
| `create_gate(gate_id, notary_address, expected_pair_hash, required_relation, min_separation_seconds, max_certificate_age_seconds)` | write | `ARMED`. |
| `execute_with_certificate(gate_id, certificate_id)` | write | Reads the certificate from `notary_address` via `gl.ContractAt(...).contract(IAntecedentNotary)`; checks status `VALID`, `pair_hash` match, `relation` match, minimum separation, and freshness (`now - finalized_timestamp <= max_certificate_age_seconds`, when set); writes an immutable `ExecutionReceipt`. Rejects replay (a certificate can be consumed by at most one gate execution) and re-execution of an already-`EXECUTED` gate. |
| `get_gate(gate_id)` / `get_receipt(gate_id)` | view | |
| `list_gate_ids()` | view | |

No `@gl.public.write` method on `AntecedentGate` performs a nondeterministic
call — by design, this contract is pure and deterministic.

## `MigrationExecutionConsumer` (`contracts/antecedent_consumer.py`)

The real downstream state transition the Notary + Gate exist to protect —
see [ARCHITECTURE.md](ARCHITECTURE.md#the-consumer-contract) for why Gate
alone wasn't a sufficient demonstration.

| Method | Kind | Notes |
|---|---|---|
| constructor `(gate_address)` | deploy arg | Binds this consumer to one `AntecedentGate` deployment. |
| `publish_execution_notice(gate_id, certificate_id, notice)` | write | Requires `gate.get_gate(gate_id).status == "EXECUTED"` and `gate.get_receipt(gate_id).certificate_id == certificate_id`. Rejects replay (`gate_id` can publish at most once) independent of the Gate's own one-time semantics — defense in depth. Performs zero semantic evaluation of its own. |
| `get_notice(gate_id)` / `is_published(gate_id)` / `list_published_gate_ids()` | view | |

## Frontend adapters

`lib/contract/notary.ts` / `lib/contract/gate.ts` / `lib/contract/consumer.ts`
wrap `readContract` / `writeContract` 1:1 with the methods above (see
`lib/contract/types.ts` for the TypeScript mirror of every storage
dataclass). No method exists on the frontend that doesn't exist on-chain,
and no on-chain method is left unreachable from the UI.
