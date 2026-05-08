import { useTranslation } from "react-i18next";
import type { IntroState } from "@marketplace/contracts";
import { getApiErrorMessage } from "../api/client";
import {
  useCreateIntroRequest,
  useTransitionIntroRequest,
} from "./useIntroRequests";

export function IntroRequestAction({
  introState,
  manuscriptId,
  publisherProfileId,
}: {
  introState: IntroState;
  manuscriptId: string;
  publisherProfileId: string;
}) {
  const { t } = useTranslation();
  const create = useCreateIntroRequest();
  const transition = useTransitionIntroRequest();
  const busy = create.isPending || transition.isPending;

  if (introState.status === "can_request") {
    return (
      <span className="inline-flex flex-col gap-1">
        <button
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            create.mutate({ manuscriptId, publisherProfileId, message: null })
          }
          type="button"
        >
          {t("introActions.send")}
        </button>
        {create.isError ? (
          <span className="text-xs text-rose-700">
            {getApiErrorMessage(create.error)}
          </span>
        ) : null}
      </span>
    );
  }

  if (introState.viewerCanAccept && introState.requestId) {
    return (
      <span className="inline-flex flex-wrap gap-2">
        <button
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("introActions.acceptConfirm"))) {
              transition.mutate({
                action: "accept",
                requestId: introState.requestId!,
              });
            }
          }}
          type="button"
        >
          {t("introActions.accept")}
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            transition.mutate({
              action: "reject",
              note: window.prompt(t("introActions.rejectNote")) ?? null,
              requestId: introState.requestId!,
            })
          }
          type="button"
        >
          {t("introActions.reject")}
        </button>
      </span>
    );
  }

  if (introState.viewerCanCancel && introState.requestId) {
    return (
      <button
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 disabled:opacity-50"
        disabled={busy}
        onClick={() =>
          transition.mutate({
            action: "cancel",
            requestId: introState.requestId!,
          })
        }
        type="button"
      >
        {t("introActions.cancel")}
      </button>
    );
  }

  return (
    <span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">
      {t(`introActions.state.${introState.status}`)}
    </span>
  );
}
