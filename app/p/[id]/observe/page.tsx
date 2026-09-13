"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotaryRead, useNotaryWrite } from "@/lib/contract/useContracts";
import { useTxLifecycle } from "@/lib/contract/txLifecycle";
import { waitForFinality } from "@/lib/genlayer/txWait";
import { LifecycleTracker } from "@/components/LifecycleTracker";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, TextInput } from "@/components/ui/Field";
import { useWallet } from "@/lib/wallet/WalletContext";
import type { EventRecord, PairRecord } from "@/lib/contract/types";

export default function ObservationChamberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const wallet = useWallet();
  const notaryRead = useNotaryRead();
  const notaryWrite = useNotaryWrite();
  const router = useRouter();

  const [pair, setPair] = useState<PairRecord | null>(null);
  const [eventA, setEventA] = useState<EventRecord | null>(null);
  const [eventB, setEventB] = useState<EventRecord | null>(null);
  const [certificateId, setCertificateId] = useState("");

  const sealLifecycle = useTxLifecycle();
  const observeLifecycle = useTxLifecycle();
  const certLifecycle = useTxLifecycle();

  async function refresh() {
    if (!notaryRead) return;
    const p = await notaryRead.getPair(id);
    setPair(p);
    const [a, b] = await Promise.all([notaryRead.getEvent(p.event_a_id), notaryRead.getEvent(p.event_b_id)]);
    setEventA(a);
    setEventB(b);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount idiom
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notaryRead, id]);

  async function seal(eventId: string) {
    if (!notaryWrite) return;
    await sealLifecycle.run({
      chainId: wallet.chainId,
      write: () => notaryWrite.adapter.sealEvent(eventId),
      wait: (hash) => waitForFinality(notaryWrite.client, hash),
      reread: refresh,
    });
  }

  async function observe(eventId: string) {
    if (!notaryWrite) return;
    await observeLifecycle.run({
      chainId: wallet.chainId,
      write: () => notaryWrite.adapter.observeEvent(eventId),
      wait: (hash) => waitForFinality(notaryWrite.client, hash),
      reread: refresh,
    });
  }

  async function finalize() {
    if (!notaryWrite || !certificateId) return;
    const finalState = await certLifecycle.run({
      chainId: wallet.chainId,
      write: () => notaryWrite.adapter.finalizeCertificate(certificateId, id),
      wait: (hash) => waitForFinality(notaryWrite.client, hash),
      reread: async () => {
        await notaryWrite.adapter.getCertificate(certificateId);
      },
    });
    if (finalState.stage === "STATE_REREAD") {
      router.push(`/cert/${certificateId}`);
    }
  }

  const bothObserved = eventA?.status === "OBSERVED" && eventB?.status === "OBSERVED";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl italic">Observation chamber</h1>
      <p className="mt-2 font-meta text-xs text-graphite">pair {id}</p>

      <div className="mt-8 flex flex-col gap-6">
        <EventLane label="Event A" event={eventA} onSeal={seal} onObserve={observe} />
        <EventLane label="Event B" event={eventB} onSeal={seal} onObserve={observe} />
      </div>

      <LifecycleTracker state={sealLifecycle.state} />
      <div className="h-3" />
      <LifecycleTracker state={observeLifecycle.state} />

      {bothObserved && pair && (
        <div className="mt-10 border-t border-carbon/15 pt-8">
          <h2 className="font-display text-2xl">Finalize certificate</h2>
          <p className="mt-1 text-sm text-carbon/70">
            The contract will derive {pair.relation === "SUPERSEDES" ? "the supersession relation" : "BEFORE/AFTER/SAME_DAY"}{" "}
            deterministically from the agreed observations.
          </p>
          <div className="mt-4 max-w-sm">
            <FieldWrapper label="Certificate ID" htmlFor="certId">
              <TextInput id="certId" value={certificateId} onChange={(e) => setCertificateId(e.target.value)} placeholder="cert-migration-v3" />
            </FieldWrapper>
          </div>
          <div className="mt-4">
            <Button onClick={finalize} disabled={!certificateId}>
              Finalize certificate
            </Button>
          </div>
          <LifecycleTracker state={certLifecycle.state} />
        </div>
      )}
    </div>
  );
}

function EventLane({
  label,
  event,
  onSeal,
  onObserve,
}: {
  label: string;
  event: EventRecord | null;
  onSeal: (id: string) => void;
  onObserve: (id: string) => void;
}) {
  if (!event) return <div className="font-meta text-xs text-graphite">Loading {label}…</div>;
  return (
    <div className="border border-carbon/15 p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-xl">{event.label}</p>
        <StatusBadge status={event.status} />
      </div>
      <p className="mt-1 font-meta text-xs text-graphite">{event.event_id}</p>
      <div className="mt-4">
        {event.status === "DRAFT" && (
          <Button variant="secondary" onClick={() => onSeal(event.event_id)}>
            Seal event
          </Button>
        )}
        {event.status === "SEALED" && (
          <Button variant="primary" onClick={() => onObserve(event.event_id)}>
            Run consensus observation
          </Button>
        )}
        {(event.status === "OBSERVED" || event.status === "INCONCLUSIVE" || event.status === "UNAVAILABLE") && (
          <p className="font-meta text-[11px] text-carbon/70">
            {event.observation.occurrence} · {event.observation.effective_time} ({event.observation.time_basis})
            <br />
            {event.observation.reason}
          </p>
        )}
      </div>
    </div>
  );
}
