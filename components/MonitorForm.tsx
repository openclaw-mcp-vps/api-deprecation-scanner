"use client";

import { useState } from "react";

interface MonitorFormProps {
  onCreated?: () => void;
}

export function MonitorForm({ onCreated }: MonitorFormProps) {
  const [form, setForm] = useState({
    name: "",
    apiUrl: "",
    docsUrl: "",
    changelogUrl: "",
    webhookUrl: "",
    scanIntervalMinutes: "360"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string>("");

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("Saving monitor...");

    try {
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          apiUrl: form.apiUrl,
          docsUrl: form.docsUrl || null,
          changelogUrl: form.changelogUrl || null,
          webhookUrl: form.webhookUrl || null,
          scanIntervalMinutes: Number(form.scanIntervalMinutes)
        })
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(body.error || "Could not create monitor.");
        return;
      }

      setForm({
        name: "",
        apiUrl: "",
        docsUrl: "",
        changelogUrl: "",
        webhookUrl: "",
        scanIntervalMinutes: "360"
      });
      setStatus("Monitor created. First scan runs immediately when requested.");
      onCreated?.();
    } catch {
      setStatus("Network error while creating monitor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="surface grid gap-4 p-5" onSubmit={onSubmit}>
      <h2 className="text-xl font-semibold">Add API Monitor</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="label">Monitor Name</span>
          <input
            className="input"
            onChange={(event) => updateField("name", event.target.value)}
            required
            type="text"
            value={form.name}
          />
        </label>
        <label>
          <span className="label">Primary API Endpoint</span>
          <input
            className="input"
            onChange={(event) => updateField("apiUrl", event.target.value)}
            required
            type="url"
            value={form.apiUrl}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="label">Documentation URL</span>
          <input
            className="input"
            onChange={(event) => updateField("docsUrl", event.target.value)}
            type="url"
            value={form.docsUrl}
          />
        </label>
        <label>
          <span className="label">Changelog URL</span>
          <input
            className="input"
            onChange={(event) => updateField("changelogUrl", event.target.value)}
            type="url"
            value={form.changelogUrl}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="label">Alert Webhook URL (optional)</span>
          <input
            className="input"
            onChange={(event) => updateField("webhookUrl", event.target.value)}
            type="url"
            value={form.webhookUrl}
          />
        </label>
        <label>
          <span className="label">Scan Interval (minutes)</span>
          <input
            className="input"
            min={15}
            onChange={(event) => updateField("scanIntervalMinutes", event.target.value)}
            required
            step={5}
            type="number"
            value={form.scanIntervalMinutes}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating Monitor..." : "Save Monitor"}
        </button>
        {status && <p className="text-sm text-slate-300">{status}</p>}
      </div>
    </form>
  );
}
