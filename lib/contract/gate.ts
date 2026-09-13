import type { getReadClient } from "@/lib/genlayer/client";
import type { GateRule, ExecutionReceipt } from "./types";

type AnyClient = ReturnType<typeof getReadClient>;

export function gateAdapter(client: AnyClient, address: `0x${string}`) {
  return {
    async getGate(gateId: string): Promise<GateRule> {
      return (await client.readContract({
        address,
        functionName: "get_gate",
        args: [gateId],
      })) as unknown as GateRule;
    },
    async getReceipt(gateId: string): Promise<ExecutionReceipt> {
      return (await client.readContract({
        address,
        functionName: "get_receipt",
        args: [gateId],
      })) as unknown as ExecutionReceipt;
    },
    async listGateIds(): Promise<string[]> {
      return (await client.readContract({
        address,
        functionName: "list_gate_ids",
        args: [],
      })) as unknown as string[];
    },
    async createGate(args: {
      gateId: string;
      notaryAddress: string;
      expectedPairHash: string;
      requiredRelation: string;
      minSeparationSeconds: number;
      maxCertificateAgeSeconds: number;
    }): Promise<`0x${string}`> {
      return client.writeContract({
        address,
        functionName: "create_gate",
        args: [
          args.gateId,
          args.notaryAddress,
          args.expectedPairHash,
          args.requiredRelation,
          args.minSeparationSeconds,
          args.maxCertificateAgeSeconds,
        ],
        value: 0n,
      });
    },
    async executeWithCertificate(gateId: string, certificateId: string): Promise<`0x${string}`> {
      return client.writeContract({
        address,
        functionName: "execute_with_certificate",
        args: [gateId, certificateId],
        value: 0n,
      });
    },
  };
}

export type GateAdapter = ReturnType<typeof gateAdapter>;
