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
address), waits for each to `FINALIZE`, extracts the deployed address from
`receipt.data.contract_address` (falling back to `txDataDecoded.contractAddress`), and writes
`docs/DEPLOYMENT_RECORD.json` with: git SHA, each contract's SHA-256 and byte
size, the deploy tx hash, the deployed address, and the finalization/execution
result. It refuses to run without `PRIVATE_KEY` and never fabricates a
record.

`PRIVATE_KEY` must never be committed — see `.env.example` and `.gitignore`.

## Live deployment — Studionet, chain 61999

**All three contracts are deployed and finalized on Studionet as of
2026-09-21.** Deployed via `npx tsx scripts/deploy.ts` (genlayer-js SDK).
Fix: `Event.sources` and `Observation.source_support` changed from `DynArray`
to `list` — local `DynArray()` construction had no storage path binding.

| Contract | Address | Deploy tx | Explorer |
|---|---|---|---|
| `AntecedentNotary` | `0xe26a87982B048807669d495b8a401dD549931BD1` | `0x1f35ccb6604b95ff535a9e66b494fa0e963f57a81527e3b8af36da533fe7ccd0` | [tx](https://explorer-studio.genlayer.com/tx/0x1f35ccb6604b95ff535a9e66b494fa0e963f57a81527e3b8af36da533fe7ccd0) · [address](https://explorer-studio.genlayer.com/address/0xe26a87982B048807669d495b8a401dD549931BD1) |
| `AntecedentGate` | `0xA7643c5B79390e7AEda672203F98a48bC7e71793` | `0x18b86ba82ec0461ae882984aa3601d945d11f2b6d7612ad92fe111208cbe0772` | [tx](https://explorer-studio.genlayer.com/tx/0x18b86ba82ec0461ae882984aa3601d945d11f2b6d7612ad92fe111208cbe0772) · [address](https://explorer-studio.genlayer.com/address/0xA7643c5B79390e7AEda672203F98a48bC7e71793) |
| `MigrationExecutionConsumer` | `0xeA00F62736FdD3d134C941a3c4f7823a4CC508Ea` | `0xafbfe50019676c8f83cc97b0dcea4ab6adc908eb9256b3599a8934f1291120c4` | [tx](https://explorer-studio.genlayer.com/tx/0xafbfe50019676c8f83cc97b0dcea4ab6adc908eb9256b3599a8934f1291120c4) · [address](https://explorer-studio.genlayer.com/address/0xeA00F62736FdD3d134C941a3c4f7823a4CC508Ea) |

- Signer: `0x834942701bC9b5eb3F511378AC84EDdeA93f2C8b`
- Git SHA at deployment: `6bb383c` (branch `main`)
- Source SHA-256: `antecedent_notary.py` `fe385a8dd2c25b6dd90aa6be1501a4a075316b601ee57103a5e771c0f7a36e25` (38,516 bytes) · `antecedent_gate.py` `f409cc4cc36c42655390ebf244870e6cef26a75e0e36308fbc06e079c043644b` (5,720 bytes) · `antecedent_consumer.py` `16775081c136a4a780b5f5746aedae2642ff90f3aa6e6f74fe3404c25bc12a5a` (3,400 bytes)
- Full machine-readable record: [`docs/DEPLOYMENT_RECORD.json`](DEPLOYMENT_RECORD.json)
- Frontend deployed to **https://antecedent.vercel.app** with all three
  addresses set as Vercel production environment variables
  (`NEXT_PUBLIC_NOTARY_ADDRESS`, `NEXT_PUBLIC_GATE_ADDRESS`,
  `NEXT_PUBLIC_CONSUMER_ADDRESS`) — baked into the build.

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
