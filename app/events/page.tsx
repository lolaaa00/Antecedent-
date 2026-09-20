"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNotaryRead, useDeploymentStatus } from "@/lib/contract/useContracts";
import { NotDeployedNotice } from "@/components/NotDeployedNotice";
import { StatusBadge } from "@/components/StatusBadge";
import type { EventRecord } from "@/lib/contract/types";

export default function EventsPage() {
  const { notaryDeployed } = useDeploymentStatus();
  const notary = useNotaryRead();
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notary) return;
    let cancelled = false;
    (async () => {
      try {
        const ids = await notary.listEventIds();
        const records = await Promise.all(ids.map((id) => notary.getEvent(id)));
        if (!cancelled) setEvents(records);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed to load events");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notary]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-4xl italic">Event definitions</h1>
      <p className="mt-2 max-w-2xl text-sm text-carbon/70">
        Each event freezes a semantic criterion, 1–3 HTTPS sources, and a time-extraction
        policy. Once sealed, the definition is immutable.
      </p>

      {!notaryDeployed && <div className="mt-6"><NotDeployedNotice contract="Notary" /></div>}
      {error && <p className="mt-6 font-meta text-xs text-vermilion">{error}</p>}
      {notaryDeployed && events === null && !error && (
        <p className="mt-6 font-meta text-xs text-graphite">Loading…</p>
      )}
      {events && events.length === 0 && (
        <p className="mt-6 font-meta text-xs text-graphite">No events yet.</p>
      )}

      <ul className="mt-8 divide-y divide-carbon/10 border-t border-carbon/15">
        {events?.map((ev) => (
          <li key={ev.event_id} className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/events/${ev.event_id}`} className="group">
                  <p className="font-display text-lg group-hover:underline">{ev.label}</p>
                  <p className="font-meta text-xs text-graphite">{ev.event_id}</p>
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={ev.status} />
                {(ev.status === "DRAFT" || ev.status === "SEALED") && (
                  <Link
                    href={`/events/${ev.event_id}`}
                    className="font-meta text-[11px] uppercase tracking-wide text-cobalt hover:underline"
                  >
                    {ev.status === "DRAFT" ? "Seal →" : "Observe →"}
                  </Link>
                )}
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-carbon/70">{ev.criterion}</p>
            <ul className="mt-2 flex flex-wrap gap-3">
              {ev.sources.map((s) => (
                <li key={s} className="font-meta text-[11px] text-graphite">
                  {s}
                </li>
              ))}
            </ul>
            {ev.status !== "DRAFT" && ev.observation.occurrence && (
              <p className="mt-2 font-meta text-[11px] text-brass">
                observed: {ev.observation.occurrence} · {ev.observation.effective_time} (
                {ev.observation.time_basis})
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
