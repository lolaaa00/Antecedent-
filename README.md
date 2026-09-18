# Antecedent

**Not just what happened. What happened first.**

Live: **https://antecedent.vercel.app** — all three contracts
(`AntecedentNotary`, `AntecedentGate`, `MigrationExecutionConsumer`) are
deployed and finalized on Studionet, verified independently via the
`genlayer` CLI and the public block explorer. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for addresses, tx hashes, explorer
links, and a currently-open read-propagation-lag note.

Antecedent is a consensus-backed **sequence notary** on GenLayer Studionet. It
certifies that one declared public event materially occurred **BEFORE**,
**AFTER**, **SAME_DAY**, or was **SUPERSEDED BY** another declared public
event — and exposes the resulting certificate to downstream contracts that
gate real execution on it.

This is not "did webpage X say Y" (WebWitness). The primitive here is the
**ordered relationship between two independently-observed events**, and
ordering is never asserted by a model — when source time is explicit, it is
derived deterministically in-contract from two independently-agreed
timestamps.

## Why GenLayer, not a centralized operator

If a single operator decided "A happened before B," nothing would stop them
from asserting a false order to make an ineligible action look eligible.
Antecedent's leader/validator consensus means no single party's opinion is
authoritative — every validator independently re-fetches the frozen sources,
re-classifies occurrence and time, and must materially agree before a
certificate is produced. See [docs/CONSENSUS.md](docs/CONSENSUS.md).

## Architecture

Three contracts:

- **`contracts/antecedent_notary.py`** — event definitions, sealing, consensus
  observation, deterministic relation derivation, immutable certificates,
  digest-bound evidence commitments.
- **`contracts/antecedent_gate.py`** — a pure, non-semantic downstream
  consumer: it reads a certificate from the notary and records whether a
  consequential action is eligible (executable eligibility as shared state).
- **`contracts/antecedent_consumer.py`** — `MigrationExecutionConsumer`, the
  actual protected downstream action: it can publish a canonical execution
  notice only once a specific gate has reached `EXECUTED` against a matching
  certificate.

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/CONTRACT_SURFACE.md](docs/CONTRACT_SURFACE.md).

## Network

Canonical target: **GenLayer Studionet**, chain `61999`,
`https://studio.genlayer.com/api`. See `lib/genlayer/network.ts` — every
read/write path imports chain config from that single module, and
`npm run check:network` verifies it resolves correctly.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 ·
Framer Motion · Zod · viem · `genlayer-js` pinned exactly to `1.1.8`.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_NOTARY_ADDRESS / NEXT_PUBLIC_GATE_ADDRESS / NEXT_PUBLIC_CONSUMER_ADDRESS after deploying
npm run dev
```

> Note: `npm run dev` / `npm run build` pass `--webpack` explicitly. Next
> 16.3.5's Turbopack pipeline currently fails on this project's Tailwind 4
> setup with `Missing field 'negated' on ScannerOptions.sources` (a
> Turbopack/`@tailwindcss/oxide` native-binding incompatibility, reproduced
> with matched `tailwindcss`/`@tailwindcss/postcss`/`@tailwindcss/oxide`
> versions). Webpack builds are unaffected and this is what CI uses.

## Testing

```bash
npm run test:contracts   # Python contract logic, via a local stub harness (see tests/contract/genlayer_stub.py)
npm run test             # Vitest — validation, network guard, tx lifecycle
npm run typecheck
npm run lint
npm run build
```

`npm ci` on Linux (verified for real on Vercel's Linux build runners, not
just asserted) correctly installs the Linux-native `@tailwindcss/oxide` /
`lightningcss` binaries — an earlier lockfile only recorded the macOS variant
after incremental `npm install` calls; see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the root cause and fix.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the real deployment attempt
record (a genuine Studionet infrastructure blocker is documented there, not
papered over) and [docs/REVIEWER_DEMO.md](docs/REVIEWER_DEMO.md) for the
canonical "Responsible Migration" walkthrough.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for web-evidence hardening, value
safety (n/a — no GEN custody in this product), and secret handling.
