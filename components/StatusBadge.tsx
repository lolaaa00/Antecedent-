import clsx from "clsx";

const TONE: Record<string, string> = {
  DRAFT: "border-graphite text-graphite",
  SEALED: "border-cobalt text-cobalt",
  OBSERVED: "border-carbon text-carbon",
  VALID: "border-cobalt text-cobalt",
  EXECUTED: "border-cobalt text-cobalt",
  ARMED: "border-brass text-brass",
  INCONCLUSIVE: "border-brass text-brass",
  UNAVAILABLE: "border-vermilion text-vermilion",
  INVALID_RELATION: "border-vermilion text-vermilion",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-meta text-[11px] uppercase tracking-wider",
        TONE[status] ?? "border-graphite text-graphite",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}
