# Contract surface

## `AntecedentNotary` (`contracts/antecedent_notary.py`)

| Method | Kind | Notes |
|---|---|---|
| `create_event(event_id, label, criterion, sources, time_extraction_policy)` | write | `DRAFT`. Validates bounds + URL hardening. |
| `seal_event(event_id)` | write | Creator-only. `DRAFT → SEALED`. Irreversible. |
| `observe_event(event_id)` | write | Requires `SEALED`. Runs leader/validator consensus. `SEALED → OBSERVED\|INCONCLUSIVE\|UNAVAILABLE`. One-shot. |
| `create_pair(pair_id, event_a_id, event_b_id, relation, min_separation_seconds, max_separation_seconds, source_independence_policy)` | write | Both events must be sealed (or further along). Immutable from creation; `pair_hash` binds both events' `definition_hash`. |
| `finalize_certificate(certificate_id, pair_id)` | write | Requires both events observed for a temporal relation, re-validates definition hashes against the pair, derives relation deterministically (or runs the SUPERSEDES semantic round). One-shot per `certificate_id`. |
| `get_event(event_id)` / `get_pair(pair_id)` / `get_certificate(certificate_id)` | view | Raise on unknown id. |
| `list_event_ids()` / `list_pair_ids()` | view | For frontend enumeration. |

### Event statuses
`DRAFT → SEALED → {OBSERVED | INCONCLUSIVE | UNAVAILABLE}` (terminal).

### Certificate statuses
`VALID | INCONCLUSIVE | UNAVAILABLE | INVALID_RELATION` (all terminal —
certificates are never mutated after `finalize_certificate` returns).

## `AntecedentGate` (`contracts/antecedent_gate.py`)

| Method | Kind | Notes |
|---|---|---|
| `create_gate(gate_id, notary_address, expected_pair_hash, required_relation, min_separation_seconds, max_certificate_age_seconds)` | write | `ARMED`. |
| `execute_with_certificate(gate_id, certificate_id)` | write | Reads the certificate from `notary_address` via `gl.ContractAt(...).contract(IAntecedentNotary)`; checks status `VALID`, `pair_hash` match, `relation` match, minimum separation, and freshness (`now - finalized_timestamp <= max_certificate_age_seconds`, when set); writes an immutable `ExecutionReceipt`. Rejects replay (a certificate can be consumed by at most one gate execution) and re-execution of an already-`EXECUTED` gate. |
| `get_gate(gate_id)` / `get_receipt(gate_id)` | view | |
| `list_gate_ids()` | view | |

No `@gl.public.write` method on `AntecedentGate` performs a nondeterministic
call — by design, this contract is pure and deterministic (see
[docs/ARCHITECTURE.md](ARCHITECTURE.md) for why that separation matters).

## Frontend adapters

`lib/contract/notary.ts` / `lib/contract/gate.ts` wrap `readContract` /
`writeContract` 1:1 with the methods above (see `lib/contract/types.ts` for
the TypeScript mirror of every storage dataclass). No method exists on the
frontend that doesn't exist on-chain, and no on-chain method is left
unreachable from the UI.
