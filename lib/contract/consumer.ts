import type { getReadClient } from "@/lib/genlayer/client";
import type { PublishedNotice } from "./types";

type AnyClient = ReturnType<typeof getReadClient>;

export function consumerAdapter(client: AnyClient, address: `0x${string}`) {
  return {
    async getNotice(gateId: string): Promise<PublishedNotice> {
      return (await client.readContract({
        address,
        functionName: "get_notice",
        args: [gateId],
      })) as unknown as PublishedNotice;
    },
    async isPublished(gateId: string): Promise<boolean> {
      return (await client.readContract({
        address,
        functionName: "is_published",
        args: [gateId],
      })) as unknown as boolean;
    },
    async publishExecutionNotice(gateId: string, certificateId: string, notice: string): Promise<`0x${string}`> {
      return client.writeContract({
        address,
        functionName: "publish_execution_notice",
        args: [gateId, certificateId, notice],
        value: 0n,
      });
    },
  };
}

export type ConsumerAdapter = ReturnType<typeof consumerAdapter>;
