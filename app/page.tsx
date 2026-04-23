import Link from "next/link";
import {
  BellRing,
  CloudAlert,
  Gauge,
  LockKeyhole,
  Radar,
  ShieldAlert,
  TimerReset
} from "lucide-react";

const faqs = [
  {
    question: "What does the scanner check?",
    answer:
      "It checks API response headers, docs pages, and changelog feeds for deprecation notices, sunset dates, breaking-change language, and version drift."
  },
  {
    question: "How early can it warn us?",
    answer:
      "You get alerts as soon as a source changes. In practice, teams often catch removals days or weeks before they impact production deploys."
  },
  {
    question: "Can we route alerts to Slack, PagerDuty, or custom tooling?",
    answer:
      "Yes. Every monitor can send structured webhook alerts, so you can fan out to Slack, incident systems, and internal automation."
  },
  {
    question: "Is this only for REST APIs?",
    answer:
      "No. You can track any endpoint or documentation source with HTTP access, including REST, GraphQL docs, and versioned changelog pages."
  }
];

export default function HomePage() {
  const buyLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

  return (
    <main className="py-8 md:py-12">
      <header className="surface relative overflow-hidden p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl"
        />
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
          <Radar size={16} />
          API Monitoring for Deprecation Risk
        </div>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
          Monitor APIs for deprecation notices and breaking changes
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
          API Deprecation Scanner continuously watches your dependencies and warns your team before a deprecated endpoint
          turns into a production outage.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a className="btn-primary" href={buyLink} rel="noreferrer" target="_blank">
            Start Monitoring for $15/month
          </a>
          <Link className="btn-secondary" href="/dashboard">
            Open Dashboard
          </Link>
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="surface p-5">
          <CloudAlert className="text-rose-300" size={20} />
          <h2 className="mt-3 text-lg font-semibold">The Problem</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Third-party APIs ship breaking changes with short notice. Teams find out when jobs fail, mobile apps crash, or
            checkout flows break.
          </p>
        </article>
        <article className="surface p-5">
          <ShieldAlert className="text-amber-300" size={20} />
          <h2 className="mt-3 text-lg font-semibold">The Solution</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            We scan response headers, docs, and changelog text for deprecation and sunset language, then highlight
            severity and expected blast radius.
          </p>
        </article>
        <article className="surface p-5">
          <TimerReset className="text-sky-300" size={20} />
          <h2 className="mt-3 text-lg font-semibold">Why Teams Pay</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Avoid emergency rewrites and after-hours incidents. One early warning can save multiple engineer-days and
            preserve release velocity.
          </p>
        </article>
      </section>

      <section className="mt-8 surface p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">What You Get</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <li className="flex gap-2">
                <BellRing className="mt-0.5 text-emerald-300" size={16} />
                Automated scans on your preferred interval with digestible, actionable alerts.
              </li>
              <li className="flex gap-2">
                <Gauge className="mt-0.5 text-emerald-300" size={16} />
                Severity scoring for deprecations, breaking-change wording, and version shifts.
              </li>
              <li className="flex gap-2">
                <LockKeyhole className="mt-0.5 text-emerald-300" size={16} />
                Private dashboard behind a purchase-gated cookie and webhook-ready notifications.
              </li>
            </ul>
          </div>
          <div className="surface border border-slate-700/80 bg-slate-950/30 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-400">Pricing</p>
            <h3 className="mt-2 text-3xl font-extrabold">$15 / month</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Built for dev teams that depend on payment, messaging, auth, or analytics APIs. Monitor as many critical
              API surfaces as you need from one dashboard.
            </p>
            <a className="btn-primary mt-4 w-full" href={buyLink} rel="noreferrer" target="_blank">
              Buy With Stripe Hosted Checkout
            </a>
          </div>
        </div>
      </section>

      <section className="mt-8 surface p-6 md:p-8">
        <h2 className="text-2xl font-bold">FAQ</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <article className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-4" key={faq.question}>
              <h3 className="text-sm font-semibold text-slate-100">{faq.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
