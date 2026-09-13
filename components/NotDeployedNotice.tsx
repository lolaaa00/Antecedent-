export function NotDeployedNotice({ contract }: { contract: string }) {
  return (
    <div className="border border-vermilion/60 bg-vermilion/5 p-4 font-meta text-xs uppercase tracking-wide text-vermilion">
      {contract} address is not configured. Set NEXT_PUBLIC_NOTARY_ADDRESS / NEXT_PUBLIC_GATE_ADDRESS in
      .env.local after running scripts/deploy.ts against Studionet.
    </div>
  );
}
