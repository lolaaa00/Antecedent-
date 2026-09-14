import type { getReadClient } from "@/lib/genlayer/client";
import type { EventRecord, PairRecord, CertificateRecord } from "./types";

type AnyClient = ReturnType<typeof getReadClient>;

export function notaryAdapter(client: AnyClient, address: `0x${string}`) {
  return {
    async getEvent(eventId: string): Promise<EventRecord> {
      return (await client.readContract({
        address,
        functionName: "get_event",
        args: [eventId],
      })) as unknown as EventRecord;
    },
    async getPair(pairId: string): Promise<PairRecord> {
      return (await client.readContract({
        address,
        functionName: "get_pair",
        args: [pairId],
      })) as unknown as PairRecord;
    },
    async getCertificate(certificateId: string): Promise<CertificateRecord> {
      return (await client.readContract({
        address,
        functionName: "get_certificate",
        args: [certificateId],
      })) as unknown as CertificateRecord;
    },
    async listEventIds(): Promise<string[]> {
      return (await client.readContract({
        address,
        functionName: "list_event_ids",
        args: [],
      })) as unknown as string[];
    },
    async listPairIds(): Promise<string[]> {
      return (await client.readContract({
        address,
        functionName: "list_pair_ids",
        args: [],
      })) as unknown as string[];
    },
    async createEvent(args: {
      eventId: string;
      label: string;
      criterion: string;
      sources: string[];
      timeExtractionPolicy: string;
    }): Promise<`0x${string}`> {
      return client.writeContract({
        address,
        functionName: "create_event",
        args: [args.eventId, args.label, args.criterion, args.sources, args.timeExtractionPolicy],
        value: 0n,
      });
    },
    async sealEvent(eventId: string): Promise<`0x${string}`> {
      return client.writeContract({
        address,
        functionName: "seal_event",
        args: [eventId],
        value: 0n,
      });
    },
    async observeEvent(eventId: string): Promise<`0x${string}`> {
      return client.writeContract({
        address,
        functionName: "observe_event",
        args: [eventId],
        value: 0n,
      });
    },
    async createPair(args: {
      pairId: string;
      eventAId: string;
      eventBId: string;
      relation: string;
      minSeparationSeconds: number;
      maxSeparationSeconds: number;
      sourceIndependencePolicy: string;
      requireDistinctSourceHosts: boolean;
    }): Promise<`0x${string}`> {
      return client.writeContract({
        address,
        functionName: "create_pair",
        args: [
          args.pairId,
          args.eventAId,
          args.eventBId,
          args.relation,
          args.minSeparationSeconds,
          args.maxSeparationSeconds,
          args.sourceIndependencePolicy,
          args.requireDistinctSourceHosts,
        ],
        value: 0n,
      });
    },
    async finalizeCertificate(certificateId: string, pairId: string): Promise<`0x${string}`> {
      return client.writeContract({
        address,
        functionName: "finalize_certificate",
        args: [certificateId, pairId],
        value: 0n,
      });
    },
  };
}

export type NotaryAdapter = ReturnType<typeof notaryAdapter>;
