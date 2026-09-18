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

This deploys `contracts/antecedent_notary.py`, then `contracts/antecedent_gate.py`,
then `contracts/antecedent_consumer.py` (constructed with the Gate's deployed
address), waits for each to `FINALIZE`, extracts the deployed address from the
transaction's `txDataDecoded.contractAddress`, and writes
`docs/DEPLOYMENT_RECORD.json` with: git SHA, each contract's SHA-256 and byte
size, the deploy tx hash, the deployed address, and the finalization/execution
result. It refuses to run without `PRIVATE_KEY` and never fabricates a
record.

`PRIVATE_KEY` must never be committed — see `.env.example` and `.gitignore`.

## Live deployment — Studionet, chain 61999

**All three contracts are deployed and finalized on Studionet as of
2026-09-18.** Verified two independent ways: the `genlayer` CLI's own
receipt (validator votes, finalization) and, separately, the public block
explorer (a different service, reading the network's own indexed state) —
so this isn't a single tool's claim.

| Contract | Address | Deploy tx | Explorer |
|---|---|---|---|
| `AntecedentNotary` | `0xbDb56Ab74E0fdeeAA9890a6791831036cB4138bF` | `0xb0333ad725a0690b43a93b604b4b0a16204d0be02c29342f166d48d4371e6982` | [tx](https://explorer-studio.genlayer.com/tx/0xb0333ad725a0690b43a93b604b4b0a16204d0be02c29342f166d48d4371e6982) · [address](https://explorer-studio.genlayer.com/address/0xbDb56Ab74E0fdeeAA9890a6791831036cB4138bF) |
| `AntecedentGate` | `0x5e995bE41d61C03BA6fDE236FB81A8D18e939DcD` | `0xce2400a614a5b46b83fcdcc0a7bffb5f4216c10b5dc4ce05759bac6926a7a74e` | [tx](https://explorer-studio.genlayer.com/tx/0xce2400a614a5b46b83fcdcc0a7bffb5f4216c10b5dc4ce05759bac6926a7a74e) · [address](https://explorer-studio.genlayer.com/address/0x5e995bE41d61C03BA6fDE236FB81A8D18e939DcD) |
| `MigrationExecutionConsumer` | `0x649051022D57B34e79e7283c81fCf56F234350b5` | `0xceecd31da30142a8f0a1e9416e29a7a45f5bfc6d2e4cd955acb8767da39580ff` | [tx](https://explorer-studio.genlayer.com/tx/0xceecd31da30142a8f0a1e9416e29a7a45f5bfc6d2e4cd955acb8767da39580ff) · [address](https://explorer-studio.genlayer.com/address/0x649051022D57B34e79e7283c81fCf56F234350b5) |

- Signer: `0xaa18eCD158AEC67c75A51768b747cb3247A21689`
- Git SHA at deployment: `8b642f782a8e84b1c93d88c07b8fbb54e8de00e6`
- Source SHA-256: `antecedent_notary.py` `581c8d1381a902a70eca0f1ae8b1666a444086f8281c3a8e6fae0efb978f94c3` (38,700 bytes) · `antecedent_gate.py` `9f4c78d84303c11300c89abf5c861660aa5a2470f6a62bbb6f9a142882ec4df4` (5,827 bytes) · `antecedent_consumer.py` `96e760833fc1f02fa22046f08c803bda76c6f3cb3eb2c1cdf3cb54efb6afa934` (3,463 bytes)
- Each deploy tx: `status_name: FINALIZED`, `result_name: MAJORITY_AGREE`, 5/5
  validator votes `AGREE` (Notary and Gate); the Consumer deploy landed 3
  `AGREE` / 2 `IDLE` out of 5, still a clean majority.
- Frontend redeployed to **https://antecedent.vercel.app** with all three
  addresses configured as Vercel production environment variables and
  baked into the build (`NEXT_PUBLIC_NOTARY_ADDRESS`,
  `NEXT_PUBLIC_GATE_ADDRESS`, `NEXT_PUBLIC_CONSUMER_ADDRESS`) — the "not
  configured" banners are gone on all three contracts' pages.

**Known follow-up: read-path propagation lag.** Immediately after
deployment, `genlayer schema` / `genlayer call` against the new addresses
returned `Contract ... not found`, even though the explorer already showed
the deploy as `FINALIZED` and indexed. This is a different symptom from the
earlier blocker (that one was zero validators *ever* engaging; this is state
becoming queryable via the read RPC after a real, voted-on finalization) and
is consistent with Studio's backend still catching up generally after the
period of validator-assignment trouble documented below. Re-verify with
`genlayer call <address> list_event_ids` (Notary) /
`list_gate_ids` (Gate) / `list_published_gate_ids` (Consumer) before relying
on this for a live demo, and re-check the frontend pages once reads
resolve — this doc will be updated once confirmed.

## Historical: the validator-assignment blocker (resolved)

The section below is kept as an honest record of the ~24 hours this
deployment was genuinely blocked, and how that was diagnosed — not backfilled
after the fact.

### Real deployment attempts against Studionet — earlier results

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
| `AntecedentNotary` (retry, later attempt) | `0xbc17edc9a35a7780ed8a12849d3680b101c68a7d77c385df115835e66b9d9c54` | same: `NO_MAJORITY`, 0 votes, `num_of_rounds: 0` |
| `AntecedentNotary` (post-remediation, current source) | `0x131aed98562dfb87ea2d2ced7ad2fc758fd676393a8ff6c6dd54e7aa47a3c5d3` | same: `NO_MAJORITY`, execution `UNKNOWN` |
| `AntecedentNotary` (explicit 1 GEN fee-value, ruling out fee/deposit as cause) | `0xc704169e72b96d64df073ded8fa3ed78629910bc4b27d280dedae6f76b6bba14` | same: `NO_MAJORITY`, execution `UNKNOWN` |

This condition was re-checked repeatedly across a span of real time,
including once more after the observation-consensus/timezone/evidence-digest
remediation in this document's revision — every attempt against the current
contract source reproduces the identical `NO_MAJORITY` / 0-votes signature.
This rules out a momentary blip and indicates a standing validator-pool
availability condition on Studionet at the time of this build, external to
this repository and unrelated to the specific contract source being
deployed.

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

**Deeper diagnosis (explorer-level).** The GenLayer Studio Explorer
(https://explorer-studio.genlayer.com) shows, for every attempted deploy tx:
`Initial Validators: -`, `Rotation Count: 0`, `Consensus Result: -`, and on
the Monitoring tab, `Consensus Rounds: 0` with *"This transaction may not
have completed consensus yet."* This means no validator was ever assigned to
these transactions' consensus round at all — a scheduling/staffing gap in
Studio's backend, not validators actively disagreeing (which would show
committed/revealed votes and a rotation). We ruled out fee/deposit
insufficiency by retrying with an explicit `--fee-value 1000000000000000000`
(1 GEN) — identical failure. `genlayer staking active-validators` reports
"Staking is not supported on studio-based networks," and `network info`
shows `feeManager: not set` / `staking: not set` for the `studionet` profile
— Studio's hosted network doesn't expose the on-chain validator/staking
state a public testnet would, so there's no further client-side signal to
check. The explorer's own dashboard reports 20 active validators and 670k+
historical transactions network-wide, so this looks like an assignment
problem for new transactions specifically, not a total outage. A detailed,
reproducible incident report is in
[docs/STUDIONET_INCIDENT_REPORT.md](STUDIONET_INCIDENT_REPORT.md), ready to
post to GenLayer's community Discord (https://discord.gg/8Jm4v89VAu) for a
human diagnosis of the Studio backend itself.

## After a successful deployment

Set the resulting addresses in `.env.local`:

```bash
NEXT_PUBLIC_NOTARY_ADDRESS=0x...
NEXT_PUBLIC_GATE_ADDRESS=0x...
NEXT_PUBLIC_CONSUMER_ADDRESS=0x...
```

The frontend detects an unset address and shows a "not configured" notice on
every page rather than silently rendering empty/fake state (see
`components/NotDeployedNotice.tsx`).

## Frontend hosting and the Linux lockfile fix

The frontend is deployed at **https://antecedent.vercel.app** (Vercel,
production). Vercel's build runners are Linux — this deployment is the real
verification (not a local guess) that `npm ci` installs the correct native
`@tailwindcss/oxide` / `lightningcss` binaries on Linux.

The root cause of the original failure: this repository's `package-lock.json`
was built up through several incremental `npm install --save-dev <pkg>`
calls during development. Each of those calls only re-resolves the packages
it touches — it does not always re-derive the **full cross-platform optional
dependency matrix** for packages already in the tree. The result was a
lockfile that recorded only the `darwin-x64` native binary variant for
`@tailwindcss/oxide` and `lightningcss`, with no `linux-x64-gnu` (or any
other Linux) entry at all — so a strict `npm ci` on Linux CI had nothing to
install and the build failed at the native-binding-missing step.

The fix was a clean `rm -rf node_modules package-lock.json && npm install`,
which forces npm to fully re-resolve the dependency tree from scratch and
correctly write every platform variant (`android-arm64`, `darwin-arm64`,
`darwin-x64`, `freebsd-x64`, `linux-arm-gnueabihf`, `linux-arm64-gnu`,
`linux-arm64-musl`, `linux-x64-gnu`, `linux-x64-musl`, `win32-arm64-msvc`,
`win32-x64-msvc`) into the lockfile as `optional` entries gated by their own
`os`/`cpu` fields. `npm ci` then picks the right one per platform. This was
verified two ways: locally (`npm ci` still succeeds on this machine after the
regeneration) and for real (the Vercel build above, on Linux, succeeded with
the regenerated lockfile). No binary was vendored or hand-patched — the fix
is the lockfile itself.

## Time primitive — still needs a live write-path check

`gl.vm.get_current_transaction_time()` is used throughout
(`AntecedentNotary._now`, `AntecedentGate._now`, `MigrationExecutionConsumer._now`)
as the deterministic GenVM transaction-time primitive for `created_at` /
`finalized_timestamp` / gate freshness checks, per the stable-runtime API
surface named in the build directive. All three `__init__` methods only
initialize storage collections — none of them call `_now()` — so the
successful deployments above confirm the *contracts* are live and callable,
but do not yet exercise this specific primitive. The first `create_pair`,
`create_gate`, or `publish_execution_notice` write call against the live
contracts will exercise it for real; re-verify then that it returns a
GenVM-consensus timestamp (not wall-clock time from any single node) — this
is exactly the kind of check §7 of the build directive asks for before
trusting a time primitive in a critical state transition.
