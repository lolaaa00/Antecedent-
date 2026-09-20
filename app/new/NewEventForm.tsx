"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEventSchema } from "@/lib/validation/schemas";
import { useNotaryWrite } from "@/lib/contract/useContracts";
import { useTxLifecycle } from "@/lib/contract/txLifecycle";
import { waitForFinality } from "@/lib/genlayer/txWait";
import { LifecycleTracker } from "@/components/LifecycleTracker";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, TextArea, TextInput } from "@/components/ui/Field";
import { useWallet } from "@/lib/wallet/WalletContext";

export function NewEventForm() {
  const wallet = useWallet();
  const notary = useNotaryWrite();
  const { state, run } = useTxLifecycle();
  const router = useRouter();

  const [eventId, setEventId] = useState("");
  const [label, setLabel] = useState("");
  const [criterion, setCriterion] = useState("");
  const [sourcesText, setSourcesText] = useState("");
  const [timeExtractionPolicy, setTimeExtractionPolicy] = useState(
    "Use the explicit publication or effective date/time stated on the page. If none is stated, effective_time is UNKNOWN.",
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const sources = sourcesText.split("\n").map((s) => s.trim()).filter(Boolean);
    const parsed = createEventSchema.safeParse({
      eventId,
      label,
      criterion,
      sources,
      timeExtractionPolicy,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setFieldErrors(errs);
      return;
    }
    if (!notary) return;

    const finalState = await run({
      chainId: wallet.chainId,
      write: () => notary.adapter.createEvent(parsed.data),
      wait: (hash) => waitForFinality(notary.client, hash),
      reread: async () => {
        await notary.adapter.getEvent(parsed.data.eventId);
      },
    });
    if (finalState.stage === "STATE_REREAD") {
      router.push(`/events/${parsed.data.eventId}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FieldWrapper label="Event ID" htmlFor="eventId" error={fieldErrors.eventId}>
        <TextInput id="eventId" value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="migration-proposal-v3" />
      </FieldWrapper>
      <FieldWrapper label="Label" htmlFor="label" error={fieldErrors.label}>
        <TextInput id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Migration Proposal v3 published" />
      </FieldWrapper>
      <FieldWrapper
        label="Semantic criterion"
        htmlFor="criterion"
        error={fieldErrors.criterion}
        hint="State a material, checkable condition — not 'something happened'."
      >
        <TextArea
          id="criterion"
          rows={3}
          value={criterion}
          onChange={(e) => setCriterion(e.target.value)}
          placeholder="An official notice materially states that Migration Proposal v3 has been published for public review."
        />
      </FieldWrapper>
      <FieldWrapper
        label="Sources (1–3 HTTPS URLs, one per line)"
        htmlFor="sources"
        error={fieldErrors.sources}
      >
        <TextArea
          id="sources"
          rows={3}
          value={sourcesText}
          onChange={(e) => setSourcesText(e.target.value)}
          placeholder="https://example.org/notices/migration-proposal-v3"
        />
      </FieldWrapper>
      <FieldWrapper label="Time extraction policy" htmlFor="policy" error={fieldErrors.timeExtractionPolicy}>
        <TextArea
          id="policy"
          rows={2}
          value={timeExtractionPolicy}
          onChange={(e) => setTimeExtractionPolicy(e.target.value)}
        />
      </FieldWrapper>

      <Button type="submit" disabled={!notary}>
        {notary ? "Create event" : "Connect wallet on Studionet to create"}
      </Button>

      <LifecycleTracker state={state} />
    </form>
  );
}
