export type EmailTemplateKey =
  | "intro_request_created"
  | "intro_request_accepted"
  | "intro_request_rejected"
  | "intro_request_cancelled"
  | "profile_approved"
  | "profile_rejected"
  | "profile_quarantined"
  | "manuscript_approved"
  | "manuscript_rejected"
  | "manuscript_quarantined"
  | "subscription_activated"
  | "subscription_renewed"
  | "payment_failed"
  | "subscription_inactive_downgrade";

type RenderInput = {
  appUrl: string;
  data: Record<string, unknown>;
  locale: "tr" | "en";
  templateKey: EmailTemplateKey;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function renderEmailTemplate(input: RenderInput): RenderedEmail {
  const label = safeText(input.data.targetLabel, "Smart Publishing Bridge");
  const actor = safeText(input.data.actorLabel, "Smart Publishing Bridge");
  const plan = safeText(input.data.planLabel, "Pro");
  const ctaPath = safePath(input.data.ctaPath);
  const ctaUrl = `${input.appUrl}${ctaPath}`;

  const subject = subjectFor(input.templateKey, input.locale, label, plan);
  const body = bodyFor(input.templateKey, input.locale, { actor, label, plan });
  const action = input.locale === "tr" ? "Uygulamada görüntüle" : "View in app";

  return {
    html: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(ctaUrl)}">${escapeHtml(action)}</a></p>`,
    subject,
    text: `${body}\n\n${action}: ${ctaUrl}`,
  };
}

function subjectFor(
  key: EmailTemplateKey,
  locale: "tr" | "en",
  label: string,
  plan: string,
) {
  const tr: Record<EmailTemplateKey, string> = {
    intro_request_created: `Yeni tanışma isteği: ${label}`,
    intro_request_accepted: `Tanışma isteği kabul edildi: ${label}`,
    intro_request_rejected: `Tanışma isteği yanıtlandı: ${label}`,
    intro_request_cancelled: `Tanışma isteği iptal edildi: ${label}`,
    profile_approved: "Profilin yayına hazır",
    profile_rejected: "Profilin için işlem gerekiyor",
    profile_quarantined: "Profilin incelemede",
    manuscript_approved: `Eserin hazır: ${label}`,
    manuscript_rejected: `Eserin için işlem gerekiyor: ${label}`,
    manuscript_quarantined: `Eserin incelemede: ${label}`,
    subscription_activated: `${plan} aboneliğin aktif`,
    subscription_renewed: `${plan} aboneliğin yenilendi`,
    payment_failed: "Ödeme işlemi başarısız oldu",
    subscription_inactive_downgrade: "Abonelik erişimin güncellendi",
  };
  const en: Record<EmailTemplateKey, string> = {
    intro_request_created: `New intro request: ${label}`,
    intro_request_accepted: `Intro request accepted: ${label}`,
    intro_request_rejected: `Intro request updated: ${label}`,
    intro_request_cancelled: `Intro request cancelled: ${label}`,
    profile_approved: "Your profile is ready",
    profile_rejected: "Your profile needs attention",
    profile_quarantined: "Your profile is under review",
    manuscript_approved: `Your manuscript is ready: ${label}`,
    manuscript_rejected: `Your manuscript needs attention: ${label}`,
    manuscript_quarantined: `Your manuscript is under review: ${label}`,
    subscription_activated: `${plan} is active`,
    subscription_renewed: `${plan} renewed`,
    payment_failed: "Payment failed",
    subscription_inactive_downgrade: "Subscription access updated",
  };
  return locale === "tr" ? tr[key] : en[key];
}

function bodyFor(
  key: EmailTemplateKey,
  locale: "tr" | "en",
  labels: { actor: string; label: string; plan: string },
) {
  if (locale === "tr") {
    if (key === "intro_request_created") {
      return `${labels.actor} seninle ${labels.label} için tanışmak istiyor. Detaylar güvenli çalışma alanında.`;
    }
    if (key.startsWith("intro_request_")) {
      return `${labels.label} için tanışma isteği güncellendi. Detaylar güvenli çalışma alanında.`;
    }
    if (key.startsWith("profile_")) {
      return "Profil kararın güncellendi. Detayları güvenli çalışma alanında görebilirsin.";
    }
    if (key.startsWith("manuscript_")) {
      return `${labels.label} için inceleme kararı güncellendi. Detaylar güvenli çalışma alanında.`;
    }
    return `${labels.plan} aboneliğinle ilgili önemli bir güncelleme var. Detaylar güvenli faturalama alanında.`;
  }

  if (key === "intro_request_created") {
    return `${labels.actor} wants an introduction for ${labels.label}. Details are in your secure workspace.`;
  }
  if (key.startsWith("intro_request_")) {
    return `The intro request for ${labels.label} was updated. Details are in your secure workspace.`;
  }
  if (key.startsWith("profile_")) {
    return "Your profile decision was updated. Details are in your secure workspace.";
  }
  if (key.startsWith("manuscript_")) {
    return `The review decision for ${labels.label} was updated. Details are in your secure workspace.`;
  }
  return `There is an important update for your ${labels.plan} subscription. Details are in your secure billing workspace.`;
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, 160)
    : fallback;
}

function safePath(value: unknown): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    value.length <= 300
  ) {
    return value;
  }
  return "/app/dashboard";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
