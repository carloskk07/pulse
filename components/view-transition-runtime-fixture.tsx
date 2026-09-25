"use client";

import { startTransition, useState, ViewTransition } from "react";

export function ViewTransitionRuntimeFixture() {
  const [step, setStep] = useState(0);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07090b", color: "#f5f7f8" }}>
      <section style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        <p>React ViewTransition runtime fixture</p>
        <button
          id="vt-runtime-trigger"
          type="button"
          onClick={() => {
            startTransition(() => {
              setStep((value) => value + 1);
            });
          }}
        >
          Trigger transition
        </button>
        <ViewTransition update="auto">
          <div id="vt-runtime-state" data-step={step} style={{ padding: 24 }}>
            Step {step}
          </div>
        </ViewTransition>
      </section>
    </main>
  );
}
