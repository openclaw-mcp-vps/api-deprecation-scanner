import { cookies } from "next/headers";
import Link from "next/link";
import { AccessGate } from "@/components/AccessGate";
import { DashboardClient } from "@/components/DashboardClient";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/access";
import { listAlerts, listMonitors } from "@/lib/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const access = verifyAccessToken(token);
  const paymentLink = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

  if (!access) {
    return (
      <main className="py-8 md:py-12">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">API Deprecation Scanner Dashboard</h1>
          <Link className="btn-secondary" href="/">
            Back to Landing
          </Link>
        </div>
        <AccessGate paymentLink={paymentLink} />
      </main>
    );
  }

  const [monitors, alerts] = await Promise.all([listMonitors(access.email), listAlerts(access.email, 50)]);

  return (
    <main className="py-8 md:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Signed in as {access.email}</p>
          <h1 className="text-3xl font-extrabold">Deprecation Monitor Dashboard</h1>
        </div>
        <Link className="btn-secondary" href="/">
          Back to Landing
        </Link>
      </header>

      <DashboardClient initialAlerts={alerts} initialMonitors={monitors} />
    </main>
  );
}
