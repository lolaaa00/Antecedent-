import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="grid gap-10 py-20 md:grid-cols-2 md:items-center">
        <div>
          <p className="font-meta text-xs uppercase tracking-[0.3em] text-brass">
            Studionet · chain 61999
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] italic md:text-6xl">
            Not just what happened.
            <br />
            <span className="not-italic text-cobalt">What happened first.</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-carbon/80">
            Antecedent is a consensus-backed sequence notary. It certifies that one
            declared public event materially occurred <strong>before</strong>,{" "}
            <strong>after</strong>, or was <strong>superseded by</strong> another — and
            exposes that certificate to downstream contracts that gate real
            execution on it.
          </p>
          <div className="mt-8 flex gap-4">
            <Link href="/new">
              <Button variant="primary">Declare an event pair</Button>
            </Link>
            <Link href="/timeline">
              <Button variant="secondary">Browse the timeline</Button>
            </Link>
          </div>
        </div>
        <TimelineHero />
      </section>

      <section className="grid gap-6 border-t border-carbon/15 py-16 md:grid-cols-3">
        <PrincipleCard
          index="01"
          title="Ordered relationship, not a single fact"
          body="A single page witness cannot safely establish that A preceded B. Antecedent's primitive is the pair — two independently observed events bound by a required relation."
        />
        <PrincipleCard
          index="02"
          title="The model never asserts order"
          body="When source time is explicit, BEFORE/AFTER/SAME_DAY is derived deterministically in-contract from two independently agreed timestamps — never spoken by the model."
        />
        <PrincipleCard
          index="03"
          title="Certificates gate real execution"
          body="A downstream Gate contract consumes a VALID certificate to decide executable eligibility — for example, whether a migration execution notice may be published at all."
        />
      </section>
    </div>
  );
}

function PrincipleCard({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="border-t-2 border-carbon pt-4">
      <span className="font-meta text-xs text-brass">{index}</span>
      <h3 className="mt-2 font-display text-xl">{title}</h3>
      <p className="mt-2 text-sm text-carbon/70">{body}</p>
    </div>
  );
}

function TimelineHero() {
  return (
    <div className="relative h-64 border border-carbon/20 bg-white/40">
      <div className="ruler-tick absolute inset-x-0 top-1/2 h-px opacity-30" />
      <div className="absolute left-[15%] top-[30%] flex flex-col items-center gap-2">
        <span className="font-meta text-[10px] text-graphite">EVENT A</span>
        <span className="h-3 w-3 rotate-45 bg-cobalt" aria-hidden />
      </div>
      <div className="absolute left-[65%] top-[62%] flex flex-col items-center gap-2">
        <span className="font-meta text-[10px] text-graphite">EVENT B</span>
        <span className="h-3 w-3 rotate-45 bg-vermilion" aria-hidden />
      </div>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line x1="60" y1="85" x2="260" y2="160" stroke="#B49A64" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d="M60 60 L60 200" stroke="#121417" strokeWidth="1" />
        <path d="M260 60 L260 200" stroke="#121417" strokeWidth="1" />
      </svg>
      <div className="absolute inset-x-0 bottom-3 text-center font-meta text-[10px] uppercase tracking-widest text-graphite">
        calibrated marker certifies order
      </div>
    </div>
  );
}
