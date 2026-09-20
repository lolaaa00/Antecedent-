"use client";

import { use, useEffect, useState } from "react";
import { useNotaryRead, useNotaryWrite, useDeploymentStatus } from "@/lib/contract/useContracts";
import { useTxLifecycle } from "@/lib/contract/txLifecycle";
import { waitForFinality } from "@/lib/genlayer/txWait";
import { LifecycleTracker } from "@/components/LifecycleTracker";
import { NotDeployedNotice } from "@/components/NotDeployedNotice";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/lib/wallet/WalletContext";
import type { EventRecord } from "@/lib/contract/types";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { notaryDeployed } = useDeploymentStatus();
  const wallet = useWallet();
  const notaryRead = useNotaryRead();
  const notaryWrite = useNotaryWrite();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sealLifecycle = useTxLifecycle();
  const observeLifecycle = useTxLifecycle();

  async function refresh() {
    if (!notaryRead) return;
    try {
      const ev = await notaryRead.getEvent(id);
      setEvent(ev);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load event");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notaryRead, id]);

  async function seal() {
    if (!notaryWrite) return;
    await sealLifecycle.run({
      chainId: wallet.chainId,
      write: () => notaryWrite.adapter.sealEvent(id),
      wait: (hash) => waitForFinality(notaryWrite.client, hash),
      reread: refresh,
    });
  }

  async function observe() {
    if (!notaryWrite) return;
    await observeLifecycle.run({
      chainId: wallet.chainId,
      write: () => notaryWrite.adapter.observeEvent(id),
      wait: (hash) => waitForFinality(notaryWrite.client, hash),
      reread: refresh,
    });
  }

  const canSeal = wallet.status === "CONNECTED" && wallet.isCorrectNetwork && event?.status === "DRAFT";
  const canObserve = wallet.status === "CONNECTED" && wallet.isCorrectNetwork && event?.status === "SEALED";
  const needsWallet = wallet.status !== "CONNECTED" || !wallet.isCorrectNetwork;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {!notaryDeployed && <NotDeployedNotice contract="Notary" />}

      {error && <p className="mt-4 font-meta text-xs text-vermilion">{error}</p>}

      {!event && !error && (
        <p className="font-meta text-xs text-graphite">Loading…</p>
      )}

      {event && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-meta text-xs uppercase tracking-wide text-graphite">{event.event_id}</p>
              <h1 className="mt-1 font-display text-4xl italic">{event.label}</h1>
            </div>
            <div className="mt-2">
              <StatusBadge status={event.status} />
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm text-carbon/70">{event.criterion}</p>

          <div className="mt-4">
            <p className="font-meta text-[11px] uppercase tracking-wide text-graphite">Sources</p>
            <ul className="mt-1 flex flex-col gap-1">
              {event.sources.map((s) => (
                <li key={s} className="font-meta text-xs text-cobalt underline">
                  <a href={s} target="_blank" rel="noopener noreferrer">{s}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <p className="font-meta text-[11px] uppercase tracking-wide text-graphite">Time extraction policy</p>
            <p className="mt-1 text-sm text-carbon/70">{event.time_extraction_policy}</p>
          </div>

          <div className="mt-4">
            <p className="font-meta text-[11px] uppercase tracking-wide text-graphite">Definition hash</p>
            <p className="mt-1 font-mono text-xs text-carbon/60 break-all">{event.definition_hash}</p>
          </div>

          {/* Lifecycle actions */}
          <div className="mt-8 border-t border-carbon/15 pt-8 flex flex-col gap-6">
            {/* Step 1: Seal */}
            <div>
              <h2 className="font-display text-xl">Step 1 — Seal</h2>
              <p className="mt-1 text-sm text-carbon/70">
                Sealing locks the event definition against any future edits. Required before
                this event can participate in a pair or produce a certificate.
              </p>
              <div className="mt-3">
                {event.status !== "DRAFT" ? (
                  <p className="font-meta text-xs text-carbon/50">
                    Already {event.status.toLowerCase()} — sealing is not available.
                  </p>
                ) : needsWallet ? (
                  <p className="font-meta text-xs uppercase tracking-wide text-graphite">
                    Connect wallet on Studionet to seal
                  </p>
                ) : (
                  <Button variant="secondary" onClick={seal} disabled={!canSeal}>
                    Seal event
                  </Button>
                )}
              </div>
              <LifecycleTracker state={sealLifecycle.state} />
            </div>

            {/* Step 2: Observe */}
            <div>
              <h2 className="font-display text-xl">Step 2 — Run consensus observation</h2>
              <p className="mt-1 text-sm text-carbon/70">
                Triggers GenLayer validators to fetch the event's sources and reach consensus
                on whether the criterion was met and when. The event must be sealed first.
              </p>
              <div className="mt-3">
                {event.status === "DRAFT" ? (
                  <p className="font-meta text-xs text-carbon/50">Seal the event first.</p>
                ) : event.status !== "SEALED" ? (
                  <p className="font-meta text-xs text-carbon/50">
                    Observation already ran — status is {event.status.toLowerCase()}.
                  </p>
                ) : needsWallet ? (
                  <p className="font-meta text-xs uppercase tracking-wide text-graphite">
                    Connect wallet on Studionet to observe
                  </p>
                ) : (
                  <Button variant="primary" onClick={observe} disabled={!canObserve}>
                    Run consensus observation
                  </Button>
                )}
              </div>
              <LifecycleTracker state={observeLifecycle.state} />
            </div>

            {/* Observation result */}
            {(event.status === "OBSERVED" || event.status === "INCONCLUSIVE" || event.status === "UNAVAILABLE") && (
              <div className="border border-carbon/15 p-5">
                <p className="font-meta text-[11px] uppercase tracking-wide text-graphite">Observation result</p>
                <p className="mt-2 font-display text-lg">{event.observation.occurrence}</p>
                <p className="mt-1 text-sm text-carbon/70">
                  {event.observation.effective_time} ({event.observation.time_basis})
                </p>
                {event.observation.reason && (
                  <p className="mt-2 text-sm text-carbon/70">{event.observation.reason}</p>
                )}
                {event.observation.evidence_hash && (
                  <p className="mt-2 font-mono text-[11px] text-carbon/50 break-all">
                    evidence hash: {event.observation.evidence_hash}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
