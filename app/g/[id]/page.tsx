"use client";

import { use, useEffect, useState } from "react";
import { useGateRead, useGateWrite, useConsumerRead, useConsumerWrite, useDeploymentStatus } from "@/lib/contract/useContracts";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, TextArea, TextInput } from "@/components/ui/Field";
import { useTxLifecycle } from "@/lib/contract/txLifecycle";
import { waitForFinality } from "@/lib/genlayer/txWait";
import { LifecycleTracker } from "@/components/LifecycleTracker";
import { NotDeployedNotice } from "@/components/NotDeployedNotice";
import { useWallet } from "@/lib/wallet/WalletContext";
import type { ExecutionReceipt, GateRule, PublishedNotice } from "@/lib/contract/types";

export default function GateExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const wallet = useWallet();
  const gateRead = useGateRead();
  const gateWrite = useGateWrite();
  const consumerRead = useConsumerRead();
  const consumerWrite = useConsumerWrite();
  const { gateDeployed, consumerDeployed } = useDeploymentStatus();
  const { state, run } = useTxLifecycle();
  const publishLifecycle = useTxLifecycle();

  const [gate, setGate] = useState<GateRule | null>(null);
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [notice, setNotice] = useState<PublishedNotice | null>(null);
  const [certificateId, setCertificateId] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!gateRead) return;
    const g = await gateRead.getGate(id);
    setGate(g);
    if (g.status === "EXECUTED") {
      try {
        const r = await gateRead.getReceipt(id);
        setReceipt(r);
      } catch {
        setReceipt(null);
      }
      if (consumerRead) {
        try {
          const n = await consumerRead.getNotice(id);
          setNotice(n);
        } catch {
          setNotice(null);
        }
      }
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount idiom
    refresh().catch((err) => setError(err instanceof Error ? err.message : "failed to load gate"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateRead, consumerRead, id]);

  async function onExecute(e: React.FormEvent) {
    e.preventDefault();
    if (!gateWrite || !certificateId) return;
    await run({
      chainId: wallet.chainId,
      write: () => gateWrite.adapter.executeWithCertificate(id, certificateId),
      wait: (hash) => waitForFinality(gateWrite.client, hash),
      reread: refresh,
    });
  }

  async function onPublish(e: React.FormEvent) {
    e.preventDefault();
    if (!consumerWrite || !noticeText || !receipt) return;
    await publishLifecycle.run({
      chainId: wallet.chainId,
      write: () => consumerWrite.adapter.publishExecutionNotice(id, receipt.certificate_id, noticeText),
      wait: (hash) => waitForFinality(consumerWrite.client, hash),
      reread: refresh,
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-4xl italic">Gate execution</h1>
      <p className="mt-1 font-meta text-xs text-graphite">{id}</p>
      {error && <p className="mt-4 font-meta text-xs text-vermilion">{error}</p>}
      {!gateDeployed && <div className="mt-6"><NotDeployedNotice contract="Gate" /></div>}

      {gate && (
        <div className="mt-8 border border-carbon/20 p-6">
          <div className="flex items-center justify-between">
            <p className="font-meta text-xs uppercase tracking-wide text-graphite">
              requires {gate.required_relation}
            </p>
            <StatusBadge status={gate.status} />
          </div>
          <p className="mt-2 break-all font-meta text-[11px] text-graphite">
            expected pair hash {gate.expected_pair_hash}
          </p>

          {gate.status === "ARMED" && (
            <form onSubmit={onExecute} className="mt-6 flex flex-col gap-4">
              <FieldWrapper label="Certificate ID" htmlFor="certId">
                <TextInput id="certId" value={certificateId} onChange={(e) => setCertificateId(e.target.value)} />
              </FieldWrapper>
              <Button type="submit" disabled={!gateWrite || !certificateId}>
                {gateWrite ? "Execute with certificate" : "Connect wallet on Studionet to execute"}
              </Button>
              <LifecycleTracker state={state} />
            </form>
          )}

          {gate.status === "EXECUTED" && receipt && (
            <div className="mt-6 border-t border-carbon/15 pt-4">
              <p className="font-meta text-xs uppercase tracking-wide text-cobalt">Execution receipt</p>
              <p className="mt-2 font-meta text-[11px] text-graphite">certificate {receipt.certificate_id}</p>
              <p className="font-meta text-[11px] text-graphite">executed at {receipt.executed_at}</p>
              <p className="break-all font-meta text-[11px] text-graphite">receipt hash {receipt.receipt_hash}</p>
            </div>
          )}

          {gate.status === "EXECUTED" && !consumerDeployed && (
            <div className="mt-6 border-t border-carbon/15 pt-4">
              <NotDeployedNotice contract="Consumer" />
            </div>
          )}

          {gate.status === "EXECUTED" && consumerDeployed && !notice && (
            <div className="mt-6 border-t border-carbon/15 pt-4">
              <h2 className="font-display text-xl">Publish execution notice</h2>
              <p className="mt-1 text-sm text-carbon/70">
                This is the real downstream state transition the Gate protects — a consequential
                action, not just a recorded acceptance. It can only be reached because this gate is
                EXECUTED with a matching certificate, and it can only run once.
              </p>
              <form onSubmit={onPublish} className="mt-4 flex flex-col gap-4">
                <FieldWrapper label="Notice text" htmlFor="notice">
                  <TextArea
                    id="notice"
                    rows={3}
                    value={noticeText}
                    onChange={(e) => setNoticeText(e.target.value)}
                    placeholder="Migration Execution v3 is authorized to proceed."
                  />
                </FieldWrapper>
                <Button type="submit" disabled={!consumerWrite || !noticeText}>
                  {consumerWrite ? "Publish execution notice" : "Connect wallet on Studionet to publish"}
                </Button>
                <LifecycleTracker state={publishLifecycle.state} />
              </form>
            </div>
          )}

          {gate.status === "EXECUTED" && notice && (
            <div className="mt-6 border-t border-carbon/15 pt-4">
              <p className="font-meta text-xs uppercase tracking-wide text-cobalt">Published notice</p>
              <p className="mt-2 text-sm text-carbon">{notice.notice}</p>
              <p className="mt-2 font-meta text-[11px] text-graphite">published at {notice.published_at}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
