"use client";

import { useState } from "react";
import { createPairSchema } from "@/lib/validation/schemas";
import { useNotaryWrite } from "@/lib/contract/useContracts";
import { useTxLifecycle } from "@/lib/contract/txLifecycle";
import { waitForFinality } from "@/lib/genlayer/txWait";
import { LifecycleTracker } from "@/components/LifecycleTracker";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, TextInput } from "@/components/ui/Field";
import { useWallet } from "@/lib/wallet/WalletContext";

const RELATIONS = ["BEFORE", "AFTER", "SAME_DAY", "SUPERSEDES"] as const;

export function NewPairForm() {
  const wallet = useWallet();
  const notary = useNotaryWrite();
  const { state, run } = useTxLifecycle();

  const [pairId, setPairId] = useState("");
  const [eventAId, setEventAId] = useState("");
  const [eventBId, setEventBId] = useState("");
  const [relation, setRelation] = useState<(typeof RELATIONS)[number]>("BEFORE");
  const [minSeparationSeconds, setMinSeparationSeconds] = useState("0");
  const [maxSeparationSeconds, setMaxSeparationSeconds] = useState("0");
  const [sourceIndependencePolicy, setSourceIndependencePolicy] = useState(
    "Sources for event A and event B must resolve to distinct canonical domains.",
  );
  const [requireDistinctSourceHosts, setRequireDistinctSourceHosts] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const parsed = createPairSchema.safeParse({
      pairId,
      eventAId,
      eventBId,
      relation,
      minSeparationSeconds,
      maxSeparationSeconds,
      sourceIndependencePolicy,
      requireDistinctSourceHosts,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setFieldErrors(errs);
      return;
    }
    if (!notary) return;

    await run({
      chainId: wallet.chainId,
      write: () => notary.adapter.createPair(parsed.data),
      wait: (hash) => waitForFinality(notary.client, hash),
      reread: async () => {
        await notary.adapter.getPair(parsed.data.pairId);
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldWrapper label="Pair ID" htmlFor="pairId" error={fieldErrors.pairId}>
        <TextInput id="pairId" value={pairId} onChange={(e) => setPairId(e.target.value)} placeholder="responsible-migration-v3" />
      </FieldWrapper>
      <div className="grid grid-cols-2 gap-4">
        <FieldWrapper label="Event A ID" htmlFor="eventAId" error={fieldErrors.eventAId}>
          <TextInput id="eventAId" value={eventAId} onChange={(e) => setEventAId(e.target.value)} placeholder="migration-proposal-v3" />
        </FieldWrapper>
        <FieldWrapper label="Event B ID" htmlFor="eventBId" error={fieldErrors.eventBId}>
          <TextInput id="eventBId" value={eventBId} onChange={(e) => setEventBId(e.target.value)} placeholder="migration-execution-v3" />
        </FieldWrapper>
      </div>
      <FieldWrapper label="Required relation" htmlFor="relation" error={fieldErrors.relation}>
        <select
          id="relation"
          value={relation}
          onChange={(e) => setRelation(e.target.value as (typeof RELATIONS)[number])}
          className="border border-carbon/30 bg-white/40 px-3 py-2 font-ui text-sm"
        >
          {RELATIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </FieldWrapper>
      <div className="grid grid-cols-2 gap-4">
        <FieldWrapper label="Min separation (seconds)" htmlFor="minSep" error={fieldErrors.minSeparationSeconds}>
          <TextInput
            id="minSep"
            type="number"
            min={0}
            value={minSeparationSeconds}
            onChange={(e) => setMinSeparationSeconds(e.target.value)}
          />
        </FieldWrapper>
        <FieldWrapper label="Max separation (seconds, 0 = none)" htmlFor="maxSep" error={fieldErrors.maxSeparationSeconds}>
          <TextInput
            id="maxSep"
            type="number"
            min={0}
            value={maxSeparationSeconds}
            onChange={(e) => setMaxSeparationSeconds(e.target.value)}
          />
        </FieldWrapper>
      </div>
      <FieldWrapper label="Source independence policy (human-readable label)" htmlFor="policy" error={fieldErrors.sourceIndependencePolicy}>
        <TextInput
          id="policy"
          value={sourceIndependencePolicy}
          onChange={(e) => setSourceIndependencePolicy(e.target.value)}
        />
      </FieldWrapper>
      <label className="flex items-start gap-2 text-sm text-carbon/80">
        <input
          type="checkbox"
          checked={requireDistinctSourceHosts}
          onChange={(e) => setRequireDistinctSourceHosts(e.target.checked)}
          className="mt-1"
        />
        <span>
          Enforce distinct source hosts — the contract rejects this pair at creation if event A
          and event B share a canonical source host. This is the only independence guarantee the
          contract can actually verify; it does not prove genuine editorial independence.
        </span>
      </label>

      <Button type="submit" disabled={!notary}>
        {notary ? "Create pair" : "Connect wallet on Studionet to create"}
      </Button>

      <LifecycleTracker state={state} />
    </form>
  );
}
