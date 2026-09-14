# Studionet incident report (for GenLayer Discord)

**Summary:** Contract deployment transactions to Studionet (chain 61999)
finalize with `NO_MAJORITY` and zero validators ever assigned to the
consensus round — not "validators disagreed," but no validator engaged at
all.

**Account:** `0xaa18eCD158AEC67c75A51768b747cb3247A21689` (funded, 10 GEN,
confirmed via `genlayer account show` / `genlayer balances`)

**Network profile used:** `studionet` (built-in) — chain `61999`, RPC
`https://studio.genlayer.com/api`, consensus contract
`0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575`

**Reproduction:** `genlayer deploy --contract <any .py file>` — reproduced
across 9 separate attempts over ~24 hours, including:
- A real multi-hundred-line Intelligent Contract
- A trivial 12-line contract with a single `u32` counter and no
  nondeterministic/web/LLM logic at all — same failure
- A retry with an explicit `--fee-value 1000000000000000000` (1 GEN) — same
  failure, ruling out fee/deposit insufficiency

**Explorer evidence** (e.g.
https://explorer-studio.genlayer.com/tx/0x131aed98562dfb87ea2d2ced7ad2fc758fd676393a8ff6c6dd54e7aa47a3c5d3):
- Overview: `Status: FINALIZED`, `Type: Send`, `Initial Validators: -`,
  `Rotation Count: 0`, `Consensus Result: -`
- Monitoring tab: `Consensus Rounds: 0`, `Validators: -`, *"No consensus
  history available — This transaction may not have completed consensus
  yet"*
- CLI receipt: `result_name: NO_MAJORITY`, `votes_committed: 0`,
  `votes_revealed: 0`, `num_of_rounds: 0`

**Other observations:**
- RPC reads work fine throughout (`account show`, `balances`,
  `network info`) — only the write/consensus path is affected.
- `genlayer trace <txId>` returns `Method not found: gen_dbg_traceTransaction`
  on this hosted network, so deeper GenVM-level tracing isn't available
  client-side.
- `genlayer staking active-validators` returns "Staking is not supported on
  studio-based networks" — Studio doesn't expose on-chain validator/staking
  state the way testnets do, so we can't independently confirm validator
  pool health from the client side beyond what the explorer shows.
- The explorer's own dashboard reports 20 active validators and 670k+ total
  network transactions, so the network as a whole appears up — the issue
  looks specific to how new transactions get assigned validators for their
  consensus round, not a total outage.

**Ask:** Is there a known issue with validator assignment/scheduling on
Studionet right now, or something we're missing about deploying to this
network? Happy to share the full contract source or CLI logs.
