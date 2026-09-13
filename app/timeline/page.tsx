"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNotaryRead, useDeploymentStatus } from "@/lib/contract/useContracts";
import { NotDeployedNotice } from "@/components/NotDeployedNotice";
import { StatusBadge } from "@/components/StatusBadge";
import type { EventRecord } from "@/lib/contract/types";

export default function TimelinePage() {
  const { notaryDeployed } = useDeploymentStatus();
  const notary = useNotaryRead();
  const [events, setEvents] = useState<EventRecord[]>([]);

  useEffect(() => {
    if (!notary) return;
    let cancelled = false;
    (async () => {
      const ids = await notary.listEventIds();
      const records = await Promise.all(ids.map((id) => notary.getEvent(id)));
      const observed = records.filter((r) => r.observation.effective_time && r.observation.effective_time !== "UNKNOWN");
      observed.sort((a, b) => a.observation.effective_time.localeCompare(b.observation.effective_time));
      if (!cancelled) setEvents(observed);
    })();
    return () => {
      cancelled = true;
    };
  }, [notary]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-4xl italic">Public sequence explorer</h1>
      <p className="mt-2 max-w-2xl text-sm text-carbon/70">
        Every event with an explicit, agreed effective time — ordered on a single calibrated
        track. Ordering here is read-only; certified relations live on each pair&apos;s dossier.
      </p>

      {!notaryDeployed && <div className="mt-6"><NotDeployedNotice contract="Notary" /></div>}

      <div className="relative mt-16 border-t-2 border-carbon">
        {events.map((ev, i) => (
          <div
            key={ev.event_id}
            className="relative mb-10 flex items-start gap-4"
            style={{ marginLeft: `${Math.min(i * 2, 40)}%` }}
          >
            <span className="mt-1 h-2 w-2 shrink-0 rotate-45 bg-cobalt" aria-hidden />
            <div>
              <p className="font-meta text-[10px] uppercase tracking-widest text-brass">
                {ev.observation.effective_time}
              </p>
              <p className="font-display text-lg">{ev.label}</p>
              <StatusBadge status={ev.status} />
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <p className="mt-6 font-meta text-xs text-graphite">No timestamped events yet.</p>
        )}
      </div>

      <div className="mt-12">
        <Link href="/events" className="font-meta text-xs uppercase text-cobalt underline">
          View all event definitions →
        </Link>
      </div>
    </div>
  );
}
