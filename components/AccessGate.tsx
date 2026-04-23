"use client";

import { useState } from "react";

interface AccessGateProps {
  paymentLink?: string;
}

export function AccessGate({ paymentLink }: AccessGateProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unlockAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("Checking your purchase record...");

    try {
      const response = await fetch("/api/access/grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setStatus(body.error || "Could not verify purchase. Use the same email used at checkout.");
        return;
      }

      setStatus(body.message || "Access granted. Loading dashboard...");
      window.location.reload();
    } catch {
      setStatus("Network error while checking purchase access.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="surface p-6 md:p-8">
      <h2 className="text-2xl font-bold">Dashboard Access Is Purchase-Protected</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        Buy a plan with Stripe, then unlock this dashboard using the same checkout email. Access is stored in a secure
        cookie on this browser.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a className="btn-primary" href={paymentLink} rel="noreferrer" target="_blank">
          Buy API Deprecation Scanner
        </a>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={unlockAccess}>
        <label>
          <span className="label">Purchase Email</span>
          <input
            autoComplete="email"
            className="input"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <button className="btn-secondary w-fit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Verifying..." : "Unlock Dashboard"}
        </button>
      </form>
      {status && <p className="mt-3 text-sm text-slate-300">{status}</p>}
    </section>
  );
}
