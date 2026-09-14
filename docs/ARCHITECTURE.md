# Architecture

## Three contracts, one composability boundary

```
┌─────────────────────────┐  reads certificate   ┌──────────────────────┐  reads gate + receipt   ┌──────────────────────────┐
│  AntecedentNotary        │ ────────────────────▶│  AntecedentGate       │ ───────────────────────▶│  MigrationExecution      │
│  - event definitions     │  gl.ContractAt(...)  │  - gate rules         │   gl.ContractAt(...)    │  Consumer                │
│  - sealing (immutable)   │                       │  - execution receipts │                          │  - the protected action  │
│  - consensus observation │                       │  (no semantic logic)  │                          │  (no semantic logic)     │
│  - deterministic relation│                       │                        │                          │                          │
│  - immutable certificates│                       │                        │                          │                          │
└─────────────────────────┘                       └──────────────────────┘                          └──────────────────────────┘
```

`AntecedentGate` performs **zero** semantic/AI evaluation. It is a pure,
deterministic consumer of an already-finalized certificate — the
composability boundary that lets any number of downstream products gate real
actions on notary certificates without re-running consensus each time. A
"useless wrapper contract added for scoring" would instead reimplement
notary logic or add no real constraint; Gate instead enforces four
independent, checkable conditions (pair hash match, relation match, minimum
separation, certificate freshness) before writing an immutable receipt.

## The consumer contract

Gate on its own only *records* that a certificate was accepted — that is
necessary but not sufficient to demonstrate the trust model this product
sells, because nothing outside AntecedentGate's own storage actually changes.
`MigrationExecutionConsumer` (`contracts/antecedent_consumer.py`) is the real
downstream state transition: it can publish a canonical "migration execution
notice" — an actual consequential action, not just a bookkeeping flag — only
when a specific gate has reached `EXECUTED` against a matching certificate.
It performs no semantic evaluation of its own; it inherits every guarantee
Gate already enforces (VALID status, pair-hash match, relation match, minimum
separation, freshness, one-certificate-one-execution) purely by requiring
`gate.status == "EXECUTED"` and a matching receipt, and adds its own
independent replay guard on top. The negative path is proven in
`tests/contract/test_consumer.py`: an armed-but-not-executed gate, a
certificate-id mismatch, a stale certificate, an inconclusive certificate, and
a replayed publish call are all shown to leave the protected action
unreachable.

## State machine — Event

```
DRAFT --seal_event--> SEALED --observe_event--> OBSERVED
                                              \-> INCONCLUSIVE
                                              \-> UNAVAILABLE
```

`DRAFT` is the only mutable state (creator can still be validated); once
`SEALED`, `label`/`criterion`/`sources`/`time_extraction_policy` are frozen
and `definition_hash` is fixed. `observe_event` can only run once per event —
whatever consensus outcome it reaches becomes the terminal observation state.

## State machine — Pair / Certificate

A `Pair` binds two **sealed** events' `definition_hash`es plus a required
relation and separation bounds, and is immutable from creation (`pair_hash`
is a hash of exactly those fields). `finalize_certificate` re-checks that the
live events' `definition_hash` still match what the pair recorded (defense
against a stale pair reference) before deriving the final relation:

- `BEFORE` / `AFTER` / `SAME_DAY`: derived **deterministically** in-contract
  from the two independently-agreed `effective_time` values. The model never
  outputs order.
- `SUPERSEDES`: a second, independent leader/validator round answers a
  semantic question (does B materially replace A) because supersession is
  not reducible to timestamp comparison.

A `Certificate` is written once and never mutated again.

## State machine — Gate

```
ARMED --execute_with_certificate(valid, matching, fresh cert)--> EXECUTED
```

Each certificate can be consumed by at most one gate execution
(`executed_certificate_ids` prevents replay across gates), and each gate can
execute at most once.

## Frontend / contract separation

- `lib/genlayer/` — network module, client factories, tx-finality waiter.
- `lib/contract/` — typed adapters (`notary.ts`, `gate.ts`, `consumer.ts`),
  the tx lifecycle hook, address resolution.
- `lib/wallet/` — EIP-1193 wallet context (connect/disconnect/chain-change).
- `lib/validation/` — Zod schemas mirroring every contract-side bound
  (source count, HTTPS-only, no credentials/fragments, id charset, relation
  enum, separation bounds) so the UI rejects invalid input before ever
  reaching the chain.
- `app/*` — routes only; no page contains write-path logic or contract
  encoding directly — everything goes through `lib/contract/useContracts.ts`.

Next.js server features are used only for build/static delivery — there is
no server-side data store, no server action that holds product state, and no
backend signer anywhere in this repo. The Intelligent Contracts are the sole
source of truth.
