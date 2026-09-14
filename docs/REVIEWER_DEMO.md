# Reviewer demo — "Responsible Migration"

This is the canonical demo described in the build directive: a migration may
publish its execution notice only if Antecedent has certified that the
proposal notice preceded the execution notice by a minimum interval.

> Contracts must be deployed to Studionet and their addresses set in
> `.env.local` before this walkthrough can run against live state — see
> [DEPLOYMENT.md](DEPLOYMENT.md) for the current, honest status of that step.
> Every screen below is reachable and renders correctly today (live at
> https://antecedent.vercel.app); the "not configured" banner appears
> wherever a write would otherwise be attempted against an undeployed
> contract.

## 1 — Declare both events (`/new`)

Create two events (any two static HTTPS pages you control, e.g. two GitHub
Gists or two pages of a docs site):

- **Event A** — `migration-proposal-v3`: "An official notice materially
  states that Migration Proposal v3 has been published for public review."
- **Event B** — `migration-execution-v3`: "An official notice materially
  states that Migration Execution v3 has occurred."

Each needs 1–3 HTTPS sources with an explicit, machine-readable
publication/effective date/time in the page text (e.g. `Published:
2024-06-01T00:00:00Z`) — the contract will refuse to certify ordering from an
ambiguous date.

## 2 — Seal and observe (`/p/[id]/observe`)

For each event: **Seal event**, then **Run consensus observation**. The
lifecycle tracker shows `AWAITING_SIGNATURE → SUBMITTED → CONSENSUS_RUNNING →
FINALIZED → EXECUTION_CONFIRMED → STATE_REREAD`, and the event card updates
with `occurrence`, `effective_time`, and `time_basis` once observation
lands.

## 3 — Create the pair (`/new` → "New pair")

`relation = BEFORE`, `minSeparationSeconds` set to your demo's minimum notice
window (e.g. `3600` for one hour). Leave "Enforce distinct source hosts"
checked if your two events' sources are on different domains — the contract
will reject pair creation outright if they share a canonical host. This pair
is immutable once created.

## 4 — Finalize the certificate (`/p/[id]/observe`)

Once both events show `OBSERVED`, enter a certificate id and **Finalize
certificate**. You land on `/cert/[id]` showing `final_relation: BEFORE`,
`status: VALID`, `separation_seconds`, and both full observations with
excerpts.

## 5 — Create the gate and execute (`/gates`, `/g/[id]`)

Create a gate with `expectedPairHash` copied from the pair dossier,
`requiredRelation = BEFORE`, and the same minimum separation. On `/g/[id]`,
paste the certificate id and **Execute with certificate** — the gate flips to
`EXECUTED` and shows an immutable execution receipt with a hash you can
verify independently (`receipt_hash = sha256(gate_id, certificate_id, now)`).

## 6 — Publish the protected action (`/g/[id]`)

Once the gate shows `EXECUTED`, a "Publish execution notice" form appears —
this calls `MigrationExecutionConsumer.publish_execution_notice`, the actual
consequential state transition this whole flow exists to protect (not just a
recorded acceptance on the Gate). Publish a notice; a second attempt for the
same `gate_id` reverts as a replay, and the form disappears once a notice
exists, replaced by the published text.

## Negative fixtures (from the build directive §12)

- **Reversed order**: publish the execution notice before the proposal
  notice, run the same flow — `finalize_certificate` will derive `AFTER` from
  the timestamps, which mismatches the pair's required `BEFORE`, so the
  certificate lands as `INVALID_RELATION` and the gate's
  `execute_with_certificate` call reverts with "certificate relation does not
  match gate rule."
- **Unavailable source**: point an event at a URL that 404s or is otherwise
  unfetchable — `observe_event` resolves to `UNAVAILABLE`, and
  `finalize_certificate` on a pair containing it resolves to
  `CERT_UNAVAILABLE`, never a fabricated relation.

- **Replayed publish**: call `publish_execution_notice` a second time for a
  `gate_id` that already published — rejected as replay, independent of the
  Gate's own one-time semantics.

Automated equivalents of all these fixtures are exercised in
`tests/contract/test_notary.py` (`test_before_derivation`,
`test_relation_mismatch_is_invalid`, `test_source_unavailable_yields_unavailable_status`),
`tests/contract/test_gate.py` (`test_invalid_relation_rejected`), and
`tests/contract/test_consumer.py` (`test_publish_rejects_gate_still_armed`,
`test_publish_rejects_certificate_id_mismatch`,
`test_publish_rejects_stale_certificate`,
`test_publish_rejects_inconclusive_certificate`,
`test_publish_rejects_replay`).
