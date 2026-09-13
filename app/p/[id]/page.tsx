"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useNotaryRead, useDeploymentStatus } from "@/lib/contract/useContracts";
import { NotDeployedNotice } from "@/components/NotDeployedNotice";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { EventRecord, PairRecord } from "@/lib/contract/types";

export default function PairDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { notaryDeployed } = useDeploymentStatus();
  const notary = useNotaryRead();
  const [pair, setPair] = useState<PairRecord | null>(null);
  const [eventA, setEventA] = useState<EventRecord | null>(null);
  const [eventB, setEventB] = useState<EventRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notary) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await notary.getPair(id);
        if (cancelled) return;
        setPair(p);
        const [a, b] = await Promise.all([notary.getEvent(p.event_a_id), notary.getEvent(p.event_b_id)]);
        if (!cancelled) {
          setEventA(a);
          setEventB(b);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed to load pair");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notary, id]);

  const bothObserved = eventA?.status === "OBSERVED" && eventB?.status === "OBSERVED";
  const eitherAbstained =
    eventA?.status === "INCONCLUSIVE" ||
    eventA?.status === "UNAVAILABLE" ||
    eventB?.status === "INCONCLUSIVE" ||
    eventB?.status === "UNAVAILABLE";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {!notaryDeployed && <NotDeployedNotice contract="Notary" />}
      {error && <p className="font-meta text-xs text-vermilion">{error}</p>}

      {pair && (
        <>
          <p className="font-meta text-xs uppercase tracking-wide text-brass">{pair.relation}</p>
          <h1 className="mt-2 font-display text-4xl italic">{id}</h1>
          <p className="mt-2 font-meta text-xs text-graphite">pair hash {pair.pair_hash}</p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <EventCard title="Event A" event={eventA} />
            <EventCard title="Event B" event={eventB} />
          </div>

          <div className="mt-8 flex items-center gap-4">
            {!bothObserved && !eitherAbstained && (
              <Link href={`/p/${id}/observe`}>
                <Button variant="primary">Enter observation chamber</Button>
              </Link>
            )}
            {bothObserved && (
              <Link href={`/p/${id}/observe`}>
                <Button variant="secondary">Finalize certificate</Button>
              </Link>
            )}
            {eitherAbstained && (
              <p className="font-meta text-xs uppercase text-vermilion">
                An event abstained — this pair cannot produce a VALID certificate.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EventCard({ title, event }: { title: string; event: EventRecord | null }) {
  if (!event) return <div className="border border-carbon/15 p-4 font-meta text-xs text-graphite">Loading…</div>;
  return (
    <div className="border border-carbon/15 p-4">
      <div className="flex items-center justify-between">
        <p className="font-meta text-[11px] uppercase tracking-wide text-graphite">{title}</p>
        <StatusBadge status={event.status} />
      </div>
      <p className="mt-2 font-display text-xl">{event.label}</p>
      {event.observation.occurrence && (
        <p className="mt-2 font-meta text-[11px] text-carbon/70">
          {event.observation.occurrence} · {event.observation.effective_time} ({event.observation.time_basis})
        </p>
      )}
    </div>
  );
}
