import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";

type Contact = {
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  socialLinks: Array<{ label: string; url: string }>;
};

type AcceptedContactDetails = Contact & {
  displayName: string;
};

export function SurfaceShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500">SPB-AI</p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

export function Field({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{value}</p>
    </div>
  );
}

export function TagList({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  if (values.length === 0) return null;
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ContactList({ contact }: { contact: Contact }) {
  const visible = [
    contact.email,
    contact.phone,
    contact.websiteUrl,
    ...contact.socialLinks.map((item) => item.url),
  ].filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <ul className="mt-5 space-y-2 text-sm text-slate-600">
      {contact.email ? <li>{contact.email}</li> : null}
      {contact.phone ? <li>{contact.phone}</li> : null}
      {contact.websiteUrl ? <li>{contact.websiteUrl}</li> : null}
      {contact.socialLinks.map((item) => (
        <li key={item.url}>
          <a className="underline underline-offset-4" href={item.url}>
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function AcceptedContact({
  contact,
}: {
  contact: AcceptedContactDetails;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
      <p className="font-semibold">{t("matchProfiles.acceptedIntroContact")}</p>
      <p className="mt-1">{contact.displayName}</p>
      <ContactList contact={contact} />
    </div>
  );
}

export function SurfaceMessage({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <section
      className={`rounded-lg border bg-white p-6 text-sm shadow-sm ${
        tone === "error"
          ? "border-rose-200 text-rose-700"
          : "border-slate-200 text-slate-600"
      }`}
    >
      {children}
    </section>
  );
}
