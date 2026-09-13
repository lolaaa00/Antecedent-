"use client";

import { useState } from "react";
import { NewEventForm } from "./NewEventForm";
import { NewPairForm } from "./NewPairForm";

export default function NewPage() {
  const [tab, setTab] = useState<"event" | "pair">("event");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl italic">Declare</h1>
      <p className="mt-2 text-sm text-carbon/70">
        Define an event, seal it against tampering, then bind two sealed events into a
        pair with a required temporal relation.
      </p>

      <div className="mt-8 flex gap-6 border-b border-carbon/15 font-meta text-xs uppercase tracking-wide">
        <button
          onClick={() => setTab("event")}
          className={`pb-3 ${tab === "event" ? "border-b-2 border-cobalt text-carbon" : "text-graphite"}`}
        >
          New event
        </button>
        <button
          onClick={() => setTab("pair")}
          className={`pb-3 ${tab === "pair" ? "border-b-2 border-cobalt text-carbon" : "text-graphite"}`}
        >
          New pair
        </button>
      </div>

      <div className="mt-8">{tab === "event" ? <NewEventForm /> : <NewPairForm />}</div>
    </div>
  );
}
