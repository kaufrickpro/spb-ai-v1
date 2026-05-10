import { ApiRoutes, type PublicProfileRole } from "@marketplace/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  getApiErrorCode,
  getApiErrorMessage,
  webApiClient,
} from "../../api/client";
import { useAdminSurface } from "../../admin/useAdminSurface";
import { useMarketplaceProfile } from "../../profile/useMarketplaceProfile";
import { WEB_ROUTES } from "../../routing/routes";
import { supabase } from "../../supabase/client";
import { useAuth } from "../AuthContext";
import {
  clearSignupDraft,
  getSuggestedProfileDraft,
  saveSignupDraft,
  setLastAuthMethod,
} from "../authFlowStorage";
import {
  getEmailDeliveryErrorMessageKey,
  signupRequiresEmailConfirmation,
} from "../authMessages";
import {
  buildInitials,
  buildSignupIntentOptions,
  parseSignupProfilePayload,
  resolveSignupLocale,
} from "./signupHelpers";
import { totalSignupSteps, type SignupFormState } from "./types";

export function useSignupFlow() {
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

  const showProfileLoading =
    Boolean(session) && (profileQuery.isPending || adminSurface.isLoading);
  const showPasswordStep = stepIndex === 0;
  const showProfileStep = stepIndex === 1;
  const showIntentStep = stepIndex === 2;
  const intentOptions = buildSignupIntentOptions(form.role);

  function getRedirectTo() {
    if (adminSurface.hasAdminAccess) {
      return WEB_ROUTES.admin;
    }

    if (adminSurface.requiresMfa) {
      return WEB_ROUTES.adminMfa;
    }

    if (adminSurface.hasAdminMembership) {
      return `${WEB_ROUTES.adminLogin}?reason=staff`;
    }

    if (profileQuery.data?.profile) {
      return WEB_ROUTES.profile;
    }

    return null;
  }

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

    const parsed = parseSignupProfilePayload(form, locale);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue?.message ?? t("auth.errors.generic"));
      return false;
    }

    return true;
  }

  async function createProfileAndContinue() {
    const parsed = parseSignupProfilePayload(form, locale);

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

    const parsed = parseSignupProfilePayload(form, locale);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("auth.errors.generic"));
      setLoading(false);
      return;
    }

    saveSignupDraft(parsed.data);

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

  return {
    currentStep: stepIndex + 1,
    error,
    form,
    handleNextStep,
    handlePreviousStep,
    handleRoleChange,
    intentOptions,
    loading,
    previewInitials: buildInitials(form.displayName),
    redirectTo: getRedirectTo(),
    session,
    setForm,
    showIntentStep,
    showPasswordStep,
    showProfileLoading,
    showProfileStep,
    stepIndex,
    totalSteps: totalSignupSteps,
    user,
  };
}
