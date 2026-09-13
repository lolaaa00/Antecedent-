"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGateRead, useGateWrite, useDeploymentStatus } from "@/lib/contract/useContracts";
import { NotDeployedNotice } from "@/components/NotDeployedNotice";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, TextInput } from "@/components/ui/Field";
import { useTxLifecycle } from "@/lib/contract/txLifecycle";
import { waitForFinality } from "@/lib/genlayer/txWait";
import { LifecycleTracker } from "@/components/LifecycleTracker";
import { createGateSchema } from "@/lib/validation/schemas";
import { useWallet } from "@/lib/wallet/WalletContext";
import { NOTARY_ADDRESS } from "@/lib/contract/addresses";
import type { GateRule } from "@/lib/contract/types";

export default function GatesPage() {
  const { gateDeployed } = useDeploymentStatus();
  const gateRead = useGateRead();
  const gateWrite = useGateWrite();
  const wallet = useWallet();
  const { state, run } = useTxLifecycle();

  const [gates, setGates] = useState<GateRule[] | null>(null);
  const [form, setForm] = useState({
    gateId: "",
    notaryAddress: NOTARY_ADDRESS || "",
    expectedPairHash: "",
    requiredRelation: "BEFORE" as const,
    minSeparationSeconds: "0",
    maxCertificateAgeSeconds: "0",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function refresh() {
    if (!gateRead) return;
    const ids = await gateRead.listGateIds();
    const records = await Promise.all(ids.map((gid) => gateRead.getGate(gid)));
    setGates(records);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount idiom; refresh guards on gateRead
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateRead]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const parsed = createGateSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setFieldErrors(errs);
      return;
    }
    if (!gateWrite) return;
    await run({
      chainId: wallet.chainId,
      write: () => gateWrite.adapter.createGate(parsed.data),
      wait: (hash) => waitForFinality(gateWrite.client, hash),
      reread: refresh,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-4xl italic">Downstream gates</h1>
      <p className="mt-2 max-w-2xl text-sm text-carbon/70">
        A gate performs no semantic evaluation. It consumes a VALID certificate from
        AntecedentNotary and records whether a consequential action is eligible.
      </p>

      {!gateDeployed && <div className="mt-6"><NotDeployedNotice contract="Gate" /></div>}

      <ul className="mt-8 divide-y divide-carbon/10 border-t border-carbon/15">
        {gates?.map((g) => (
          <li key={g.gate_id} className="flex items-center justify-between py-4">
            <div>
              <p className="font-display text-lg">{g.gate_id}</p>
              <p className="font-meta text-xs text-graphite">
                requires {g.required_relation} · pair {g.expected_pair_hash.slice(0, 10)}…
              </p>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge status={g.status} />
              <Link href={`/g/${g.gate_id}`} className="font-meta text-xs uppercase text-cobalt underline">
                Open →
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 border-t border-carbon/15 pt-8">
        <h2 className="font-display text-2xl">Create a gate</h2>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          <FieldWrapper label="Gate ID" htmlFor="gateId" error={fieldErrors.gateId}>
            <TextInput
              id="gateId"
              value={form.gateId}
              onChange={(e) => setForm((f) => ({ ...f, gateId: e.target.value }))}
              placeholder="publish-migration-execution-v3"
            />
          </FieldWrapper>
          <FieldWrapper label="Notary address" htmlFor="notaryAddress" error={fieldErrors.notaryAddress}>
            <TextInput
              id="notaryAddress"
              value={form.notaryAddress}
              onChange={(e) => setForm((f) => ({ ...f, notaryAddress: e.target.value }))}
            />
          </FieldWrapper>
          <FieldWrapper label="Expected pair hash" htmlFor="pairHash" error={fieldErrors.expectedPairHash}>
            <TextInput
              id="pairHash"
              value={form.expectedPairHash}
              onChange={(e) => setForm((f) => ({ ...f, expectedPairHash: e.target.value }))}
              placeholder="copy pair_hash from /p/[id]"
            />
          </FieldWrapper>
          <div className="grid grid-cols-3 gap-4">
            <FieldWrapper label="Required relation" htmlFor="rel" error={fieldErrors.requiredRelation}>
              <select
                id="rel"
                value={form.requiredRelation}
                onChange={(e) => setForm((f) => ({ ...f, requiredRelation: e.target.value as never }))}
                className="border border-carbon/30 bg-white/40 px-3 py-2 font-ui text-sm"
              >
                {["BEFORE", "AFTER", "SAME_DAY", "SUPERSEDES"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FieldWrapper>
            <FieldWrapper label="Min separation (s)" htmlFor="minSep" error={fieldErrors.minSeparationSeconds}>
              <TextInput
                id="minSep"
                type="number"
                value={form.minSeparationSeconds}
                onChange={(e) => setForm((f) => ({ ...f, minSeparationSeconds: e.target.value }))}
              />
            </FieldWrapper>
            <FieldWrapper label="Max cert age (s, 0=none)" htmlFor="maxAge" error={fieldErrors.maxCertificateAgeSeconds}>
              <TextInput
                id="maxAge"
                type="number"
                value={form.maxCertificateAgeSeconds}
                onChange={(e) => setForm((f) => ({ ...f, maxCertificateAgeSeconds: e.target.value }))}
              />
            </FieldWrapper>
          </div>
          <Button type="submit" disabled={!gateWrite}>
            {gateWrite ? "Create gate" : "Connect wallet on Studionet to create"}
          </Button>
          <LifecycleTracker state={state} />
        </form>
      </div>
    </div>
  );
}
