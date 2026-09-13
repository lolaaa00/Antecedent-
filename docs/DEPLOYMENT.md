# Deployment

## Target

GenLayer Studionet only: chain `61999`, RPC `https://studio.genlayer.com/api`,
explorer `https://explorer-studio.genlayer.com`. `lib/genlayer/network.ts` is
the single source of truth; `npm run check:network` asserts it resolves
correctly and is wired into CI.

## How to deploy (once you have a funded signer)

```bash
PRIVATE_KEY=0x... npx tsx scripts/deploy.ts
```

This deploys `contracts/antecedent_notary.py` then `contracts/antecedent_gate.py`,
waits for each to `FINALIZE`, extracts the deployed address from the
transaction's `txDataDecoded.contractAddress`, and writes
`docs/DEPLOYMENT_RECORD.json` with: git SHA, each contract's SHA-256 and byte
size, the deploy tx hash, the deployed address, and the finalization/execution
result. It refuses to run without `PRIVATE_KEY` and never fabricates a
record.

`PRIVATE_KEY` must never be committed — see `.env.example` and `.gitignore`.

## Real deployment attempt against Studionet — result

This repository ships with contract source that reaches a **funded** signer
successfully (`0xaa18eCD158AEC67c75A51768b747cb3247A21689`, 10 GEN, verified
live via `genlayer account show` / `genlayer balances` against the real
`studionet` profile: chain `61999`, RPC `https://studio.genlayer.com/api`,
consensus contract `0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575`). Using the
official `genlayer` CLI (`genlayer deploy --contract ...`), we submitted real
deployment transactions:

| Contract | Deploy tx | Result |
|---|---|---|
| `AntecedentNotary` | `0xedea2a8a34818cccb7041963cd942bc17e1c1e5fe6cb6a79d87582131d7cd1c6` | `FINALIZED`, execution `UNKNOWN`, `result_name: NO_MAJORITY`, `votes_committed: 0`, `votes_revealed: 0` |
| `AntecedentNotary` (retry) | `0x8f7a5c326f0cb001469e0a834b7d2d0d45a23ec42f0d8eae820526ff7a1b6ac6` | same: `NO_MAJORITY`, 0 votes |
| Minimal probe contract (isolation test — a 12-line contract with one `u32` counter, no consensus/web/LLM calls at all) | `0x9096674e6a2e8481a8149c508c5c5dfceb2fb49f192a6f203b45079ff5b568e4` | **same failure**: `FINALIZED`, `NO_MAJORITY`, 0 votes committed/revealed |

**Diagnosis.** The third transaction is decisive: a trivial contract with no
nondeterministic logic at all — just `self.counter = 0` in `__init__` —
failed identically. Zero votes were committed or revealed in any round for
any of the three deployments. This means Studionet's shared validator pool
did not engage with any of these transactions at the consensus layer at the
time of this attempt; it is a live-network availability condition (no
validators actively picking up rounds), not a defect in
`antecedent_notary.py`, `antecedent_gate.py`, or the deploy path. `RPC`
reads (`account show`, `balances`, `network info`) worked normally throughout
— only the write/consensus path was affected. `genlayer trace <txId>` also
returned `Method not found: gen_dbg_traceTransaction` on this hosted
network, so deeper GenVM-level tracing was not available to investigate
further from the client side.

Per the build directive's instruction to isolate a compatibility issue,
prove it with a minimal probe, and report true external blockers rather than
fabricate deployment evidence: **this is that blocker.** No contract address
is reported as deployed because none was produced. Re-running
`PRIVATE_KEY=0x... npx tsx scripts/deploy.ts` (or the equivalent
`genlayer deploy` CLI invocation) once Studionet's validator pool is
healthy again is expected to succeed without any code change — the contract
source, the funded account, and the CLI/SDK path have all been verified
independently working up to the consensus-voting step.

## After a successful deployment

Set the resulting addresses in `.env.local`:

```bash
NEXT_PUBLIC_NOTARY_ADDRESS=0x...
NEXT_PUBLIC_GATE_ADDRESS=0x...
```

The frontend detects an unset address and shows a "not configured" notice on
every page rather than silently rendering empty/fake state (see
`components/NotDeployedNotice.tsx`).

## Time primitive — needs live verification

`gl.vm.get_current_transaction_time()` is used throughout
(`AntecedentNotary._now`, `AntecedentGate._now`) as the deterministic
GenVM transaction-time primitive for `created_at` / `finalized_timestamp` /
gate freshness checks, per the stable-runtime API surface named in the build
directive. Because the deployment above did not reach a successful
execution, this call has **not yet been exercised on live Studionet**. Before
relying on it for a real freshness/deadline decision, re-verify against a
live, successfully-executing deployment that it returns a GenVM-consensus
timestamp (not wall-clock time from any single node) — this is exactly the
kind of check §7 of the build directive asks for before trusting a time
primitive in a critical state transition.
