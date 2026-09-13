"use client";

import { use, useEffect, useState } from "react";
import { useNotaryRead, useDeploymentStatus } from "@/lib/contract/useContracts";
import { NotDeployedNotice } from "@/components/NotDeployedNotice";
import { StatusBadge } from "@/components/StatusBadge";
import type { CertificateRecord } from "@/lib/contract/types";

export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { notaryDeployed } = useDeploymentStatus();
  const notary = useNotaryRead();
  const [cert, setCert] = useState<CertificateRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notary) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await notary.getCertificate(id);
        if (!cancelled) setCert(c);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed to load certificate");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notary, id]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {!notaryDeployed && <NotDeployedNotice contract="Notary" />}
      {error && <p className="font-meta text-xs text-vermilion">{error}</p>}

      {cert && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="font-display text-4xl italic">Certificate</h1>
            <StatusBadge status={cert.status} />
          </div>
          <p className="mt-1 font-meta text-xs text-graphite">{id}</p>

          <div className="mt-8 border border-carbon/20 p-6">
            <div className="grid grid-cols-2 gap-6 font-meta text-xs">
              <Field label="Final relation" value={cert.final_relation} />
              <Field label="Separation (s)" value={String(cert.separation_seconds)} />
              <Field label="Finalized at" value={new Date(cert.finalized_timestamp * 1000).toISOString()} />
              <Field label="Pair hash" value={cert.pair_hash} mono />
              <Field label="Event A" value={cert.event_a_id} />
              <Field label="Event B" value={cert.event_b_id} />
              <Field label="Certificate hash" value={cert.certificate_hash} mono />
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ObservationCard title="Event A observation" obs={cert.event_a_observation} />
            <ObservationCard title="Event B observation" obs={cert.event_b_observation} />
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="uppercase tracking-wide text-graphite">{label}</p>
      <p className={mono ? "mt-1 break-all text-carbon" : "mt-1 text-carbon"}>{value}</p>
    </div>
  );
}

function ObservationCard({ title, obs }: { title: string; obs: CertificateRecord["event_a_observation"] }) {
  return (
    <div className="border border-carbon/15 p-4">
      <p className="font-meta text-[11px] uppercase tracking-wide text-graphite">{title}</p>
      <p className="mt-2 font-meta text-xs">
        {obs.occurrence} · {obs.effective_time} ({obs.time_basis})
      </p>
      <p className="mt-2 text-xs text-carbon/70">{obs.reason}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {obs.source_support.map((s) => (
          <li key={s.source_id} className="font-meta text-[11px] text-graphite">
            #{s.source_id} {s.stance}: &ldquo;{s.excerpt}&rdquo;
          </li>
        ))}
      </ul>
    </div>
  );
}
