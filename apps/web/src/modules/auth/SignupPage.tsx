import {
  AUTHOR_SIGNUP_INTENTS,
  PUBLISHER_SIGNUP_INTENTS,
  CreateProfileRequestSchema,
  type CreateProfileRequest,
  type PublicProfileRole,
} from "@marketplace/contracts";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiRoutes } from "@marketplace/contracts";
import { useAuth } from "./AuthContext";
import {
  clearSignupDraft,
  getSuggestedProfileDraft,
  saveSignupDraft,
  setLastAuthMethod,
} from "./authFlowStorage";
import {
  getEmailDeliveryErrorMessageKey,
  signupRequiresEmailConfirmation,
} from "./authMessages";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { supabase } from "../supabase/client";
import {
  getApiErrorCode,
  getApiErrorMessage,
  webApiClient,
} from "../api/client";
import { useAdminSurface } from "../admin/useAdminSurface";
import { useMarketplaceProfile } from "../profile/useMarketplaceProfile";

type SignupFormState = {
  email: string;
  password: string;
  confirmPassword: string;
  role: PublicProfileRole;
  displayName: string;
  profilePhotoUrl: string;
  signupIntent: CreateProfileRequest["signupIntent"];
};

const stepRoleOptions: PublicProfileRole[] = ["author", "publisher"];

function resolveSignupLocale(language: string | undefined) {
  return language?.startsWith("en") ? "en" : "tr";
}

function buildInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildSignupIntentOptions(role: PublicProfileRole) {
  return role === "author" ? AUTHOR_SIGNUP_INTENTS : PUBLISHER_SIGNUP_INTENTS;
}

export function SignupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const adminSurface = useAdminSurface();
  const profileQuery = useMarketplaceProfile({
    enabled:
      Boolean(session) &&
      !adminSurface.isLoading &&
      !adminSurface.hasAdminMembership,
  });
  const locale = resolveSignupLocale(i18n.resolvedLanguage ?? i18n.language);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const suggestedDraft = getSuggestedProfileDraft({
    fallbackLocale: locale,
    profile: profileQuery.data?.profile ?? null,
    user,
  });
  const [form, setForm] = useState<SignupFormState>(() => ({
    email: "",
    password: "",
    confirmPassword: "",
    role: suggestedDraft.role,
    displayName: suggestedDraft.displayName,
    profilePhotoUrl: suggestedDraft.profilePhotoUrl ?? "",
    signupIntent: suggestedDraft.signupIntent,
  }));
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!suggestedDraft.displayName && !suggestedDraft.profilePhotoUrl) {
      return;
    }

    setForm((current) => ({
      ...current,
      role: current.role || suggestedDraft.role,
      displayName: current.displayName || suggestedDraft.displayName,
      profilePhotoUrl:
        current.profilePhotoUrl || suggestedDraft.profilePhotoUrl || "",
      signupIntent: current.signupIntent || suggestedDraft.signupIntent,
    }));
  }, [
    suggestedDraft.displayName,
    suggestedDraft.profilePhotoUrl,
    suggestedDraft.role,
    suggestedDraft.signupIntent,
  ]);

  useEffect(() => {
    const validIntents = buildSignupIntentOptions(form.role);
    if (!validIntents.some((intent) => intent === form.signupIntent)) {
      setForm((current) => ({
        ...current,
        signupIntent: validIntents[0],
      }));
    }
  }, [form.role, form.signupIntent]);

  if (adminSurface.hasAdminAccess) {
    return <Navigate to={WEB_ROUTES.admin} replace />;
  }

  if (adminSurface.requiresMfa) {
    return <Navigate to={WEB_ROUTES.adminMfa} replace />;
  }

  if (adminSurface.hasAdminMembership) {
    return <Navigate to={`${WEB_ROUTES.adminLogin}?reason=staff`} replace />;
  }

  if (session && (profileQuery.isPending || adminSurface.isLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <PlatformHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-600">{t("common.loading")}</p>
          </section>
        </main>
      </div>
    );
  }

  if (profileQuery.data?.profile) {
    return <Navigate to={WEB_ROUTES.profile} replace />;
  }

  const totalSteps = 3;
  const currentStep = stepIndex + 1;
  const intentOptions = buildSignupIntentOptions(form.role);
  const showPasswordStep = stepIndex === 0;
  const showProfileStep = stepIndex === 1;
  const showIntentStep = stepIndex === 2;
  const previewInitials = buildInitials(form.displayName);

  function handleRoleChange(role: PublicProfileRole) {
    setForm((current) => ({
      ...current,
      role,
      signupIntent: buildSignupIntentOptions(role)[0],
    }));
  }

  function validateCurrentStep(): boolean {
    if (showPasswordStep) {
      if (session) {
        return true;
      }

      if (!form.email.trim() || !form.password.trim()) {
        setError(t("auth.signup.errors.accountRequired"));
        return false;
      }

      if (form.password.length < 6) {
        setError(t("auth.signup.errors.passwordTooShort"));
        return false;
      }

      if (form.password !== form.confirmPassword) {
        setError(t("auth.signup.errors.passwordMismatch"));
        return false;
      }

      return true;
    }

    const parsed = CreateProfileRequestSchema.safeParse({
      role: form.role,
      displayName: form.displayName,
      locale,
      profilePhotoUrl: form.profilePhotoUrl,
      signupIntent: form.signupIntent,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue?.message ?? t("auth.errors.generic"));
      return false;
    }

    return true;
  }

  async function createProfileAndContinue() {
    const parsed = CreateProfileRequestSchema.safeParse({
      role: form.role,
      displayName: form.displayName,
      locale,
      profilePhotoUrl: form.profilePhotoUrl,
      signupIntent: form.signupIntent,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("auth.errors.generic"));
      return;
    }

    saveSignupDraft(parsed.data);

    try {
      await webApiClient.request(ApiRoutes.profiles.create, {
        body: parsed.data,
      });
      clearSignupDraft();
      void navigate(WEB_ROUTES.profile);
    } catch (profileError) {
      if (getApiErrorCode(profileError) === "profile_already_exists") {
        clearSignupDraft();
        void navigate(WEB_ROUTES.profile);
        return;
      }

      setError(getApiErrorMessage(profileError));
    }
  }

  async function handleFinalSubmit() {
    setError(null);
    setLoading(true);

    if (session) {
      await createProfileAndContinue();
      setLoading(false);
      return;
    }

    const payload = CreateProfileRequestSchema.parse({
      role: form.role,
      displayName: form.displayName,
      locale,
      profilePhotoUrl: form.profilePhotoUrl,
      signupIntent: form.signupIntent,
    });
    saveSignupDraft(payload);

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setLoading(false);
      setError(t(getEmailDeliveryErrorMessageKey(authError.message)));
      return;
    }

    if (signupRequiresEmailConfirmation(data.session)) {
      setLoading(false);
      const params = new URLSearchParams({
        email: form.email,
        source: "signup",
      });
      void navigate(`${WEB_ROUTES.checkEmail}?${params.toString()}`);
      return;
    }

    setLastAuthMethod("password");
    await createProfileAndContinue();
    setLoading(false);
  }

  function handleNextStep() {
    setError(null);
    if (!validateCurrentStep()) {
      return;
    }

    if (showIntentStep) {
      void handleFinalSubmit();
      return;
    }

    setStepIndex((current) => current + 1);
  }

  function handlePreviousStep() {
    setError(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />

      <main className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                {t("auth.signup.stepCounter", {
                  current: currentStep,
                  total: totalSteps,
                })}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {showPasswordStep
                  ? t("auth.signup.title")
                  : showProfileStep
                    ? t("auth.signup.profileStep.title")
                    : t("auth.signup.intentStep.title")}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {showPasswordStep
                  ? t("auth.signup.subtitle")
                  : showProfileStep
                    ? t("auth.signup.profileStep.description")
                    : t(`auth.signup.intentStep.description.${form.role}`)}
              </p>
            </div>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {error ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {showPasswordStep ? (
                session ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">
                      {t("auth.signup.accountStep.signedInTitle")}
                    </p>
                    <p className="mt-1">
                      {t("auth.signup.accountStep.signedInDescription", {
                        email: user?.email ?? t("appNav.accountFallback"),
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <FieldLabel
                      label={t("auth.signup.email")}
                      htmlFor="signup-email"
                    >
                      <input
                        id="signup-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={form.email}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      />
                    </FieldLabel>

                    <FieldLabel
                      label={t("auth.signup.password")}
                      htmlFor="signup-password"
                    >
                      <input
                        id="signup-password"
                        type="password"
                        required
                        autoComplete="new-password"
                        minLength={6}
                        value={form.password}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      />
                    </FieldLabel>

                    <FieldLabel
                      label={t("auth.signup.confirmPassword")}
                      htmlFor="signup-password-confirm"
                    >
                      <input
                        id="signup-password-confirm"
                        type="password"
                        required
                        autoComplete="new-password"
                        minLength={6}
                        value={form.confirmPassword}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                      />
                    </FieldLabel>
                  </div>
                )
              ) : null}

              {showProfileStep ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    {form.profilePhotoUrl ? (
                      <img
                        alt={
                          form.displayName ||
                          t("auth.signup.profileStep.photoAlt")
                        }
                        src={form.profilePhotoUrl}
                        className="h-16 w-16 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-500 text-xl font-semibold text-white">
                        {previewInitials || "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {t("auth.signup.profileStep.photoLabel")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("auth.signup.profileStep.photoHint")}
                      </p>
                    </div>
                  </div>

                  <FieldLabel
                    label={t("auth.signup.profileStep.photoInput")}
                    htmlFor="signup-photo-url"
                  >
                    <input
                      id="signup-photo-url"
                      type="url"
                      value={form.profilePhotoUrl}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          profilePhotoUrl: event.target.value,
                        }))
                      }
                      placeholder={t(
                        "auth.signup.profileStep.photoPlaceholder",
                      )}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                    />
                  </FieldLabel>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {stepRoleOptions.map((role) => (
                      <button
                        key={role}
                        type="button"
                        data-selected={form.role === role}
                        onClick={() => handleRoleChange(role)}
                        className="rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-400 data-[selected=true]:border-slate-950 data-[selected=true]:bg-slate-950 data-[selected=true]:text-white"
                      >
                        <p className="text-sm font-semibold">
                          {t(`auth.signup.roles.${role}.title`)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 data-[selected=true]:text-white/80">
                          {t(`auth.signup.roles.${role}.description`)}
                        </p>
                      </button>
                    ))}
                  </div>

                  <FieldLabel
                    label={t("auth.signup.profileStep.displayName")}
                    htmlFor="signup-display-name"
                  >
                    <input
                      id="signup-display-name"
                      type="text"
                      required
                      value={form.displayName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          displayName: event.target.value,
                        }))
                      }
                      placeholder={t(
                        "auth.signup.profileStep.displayNamePlaceholder",
                      )}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                    />
                  </FieldLabel>
                </div>
              ) : null}

              {showIntentStep ? (
                <div className="space-y-4">
                  <FieldLabel
                    label={t(`auth.signup.intentStep.question.${form.role}`)}
                    htmlFor="signup-intent"
                  >
                    <select
                      id="signup-intent"
                      value={form.signupIntent}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          signupIntent: event.target
                            .value as CreateProfileRequest["signupIntent"],
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                    >
                      {intentOptions.map((option) => (
                        <option key={option} value={option}>
                          {t(`auth.signup.intentOptions.${option}`)}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>

                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    {t(`auth.signup.intentStep.help.${form.role}`)}
                  </div>
                </div>
              ) : null}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  disabled={loading || stepIndex === 0}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("auth.signup.back")}
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={loading}
                  className="inline-flex min-w-36 justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loading
                    ? t("common.loading")
                    : showIntentStep
                      ? t("auth.signup.finish")
                      : t("common.continue")}
                </button>
              </div>

              <p className="mt-4 text-center text-sm text-slate-500">
                {t("auth.signup.hasAccount")}{" "}
                <Link
                  to={WEB_ROUTES.login}
                  className="font-medium text-slate-950 underline-offset-2 hover:underline"
                >
                  {t("auth.signup.loginLink")}
                </Link>
              </p>
            </section>
          </div>
        </section>

        <aside className="hidden overflow-hidden rounded-[32px] bg-slate-950 lg:block">
          <div className="relative h-full min-h-[760px] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.3),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.24),_transparent_25%),linear-gradient(180deg,_#020617,_#111827)] p-8 text-white">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(244,114,182,0.42),_transparent_45%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-white/60">
                  {t("auth.signup.aside.kicker")}
                </p>
                <h2 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">
                  {t("auth.signup.aside.title")}
                </h2>
                <p className="mt-4 max-w-sm text-sm text-white/70">
                  {t("auth.signup.aside.description")}
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <p className="text-sm font-medium text-white">
                    {t("auth.signup.aside.cardTitle")}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {t("auth.signup.aside.cardBody")}
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-white/55">
                  <span>{t("auth.signup.aside.footer.one")}</span>
                  <span>{t("auth.signup.aside.footer.two")}</span>
                  <span>{t("auth.signup.aside.footer.three")}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
