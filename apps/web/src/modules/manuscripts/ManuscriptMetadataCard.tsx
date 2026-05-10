import { useTranslation } from "react-i18next";
import type {
  Manuscript,
  UpdateManuscriptRequest,
} from "@marketplace/contracts";
import { ManuscriptForm } from "./ManuscriptForm";
import { manuscriptStatusColors, StatusBadge } from "./ManuscriptBadges";

type ManuscriptMetadataCardProps = {
  editing: boolean;
  isSaving: boolean;
  manuscript: Manuscript;
  onCancel: () => void;
  onEdit: () => void;
  onSave: (values: UpdateManuscriptRequest) => void | Promise<void>;
};

export function ManuscriptMetadataCard({
  editing,
  isSaving,
  manuscript,
  onCancel,
  onEdit,
  onSave,
}: ManuscriptMetadataCardProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{manuscript.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge
              status={manuscript.status}
              colorMap={manuscriptStatusColors}
            />
            <span className="text-xs text-slate-400">
              {t("manuscripts.detail.eligibility")}:{" "}
              {t(
                `manuscripts.eligibilityStatus.${manuscript.eligibilityStatus}`,
                { defaultValue: manuscript.eligibilityStatus },
              )}
            </span>
          </div>
        </div>
        {!editing && (
          <button
            type="button"
            id="edit-manuscript-btn"
            onClick={onEdit}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("manuscripts.form.editTitle")}
          </button>
        )}
      </div>

      {!editing ? (
        <ManuscriptMetadataView manuscript={manuscript} />
      ) : (
        <div className="mt-5">
          <ManuscriptForm
            defaultValues={{
              title: manuscript.title,
              genre: manuscript.genre,
              language: manuscript.language,
              wordCount: manuscript.wordCount ?? undefined,
              synopsis: manuscript.synopsis ?? undefined,
              logline: manuscript.logline ?? undefined,
              subgenres: manuscript.subgenres,
              audienceCategories: manuscript.audienceCategories,
              manuscriptForm: manuscript.manuscriptForm ?? undefined,
              compTitles: manuscript.compTitles,
              declaredThemes: manuscript.declaredThemes,
              declaredContentWarnings: manuscript.declaredContentWarnings,
              arcSummary: manuscript.arcSummary ?? undefined,
              shortTeaser: manuscript.shortTeaser ?? undefined,
              requestable: manuscript.requestable,
              targetAgeMin: manuscript.targetAgeMin ?? undefined,
              targetAgeMax: manuscript.targetAgeMax ?? undefined,
            }}
            onSubmit={onSave}
            onCancel={onCancel}
            isSaving={isSaving}
          />
        </div>
      )}
    </div>
  );
}

function ManuscriptMetadataView({ manuscript }: { manuscript: Manuscript }) {
  const { t } = useTranslation();

  return (
    <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
      <MetaField label={t("manuscripts.form.genre")} value={manuscript.genre} />
      <MetaField
        label={t("manuscripts.form.language")}
        value={manuscript.language.toUpperCase()}
      />
      <MetaField
        label={t("manuscripts.form.wordCount")}
        value={manuscript.wordCount?.toLocaleString() ?? "—"}
      />
      <MetaField
        label={t("manuscripts.form.targetAgeMin")}
        value={manuscript.targetAgeMin?.toString() ?? "—"}
      />
      <MetaField
        label={t("manuscripts.form.targetAgeMax")}
        value={manuscript.targetAgeMax?.toString() ?? "—"}
      />
      <MetaField
        label={t("manuscripts.form.manuscriptForm")}
        value={manuscript.manuscriptForm ?? "—"}
      />
      <MetaField
        label={t("manuscripts.form.requestable")}
        value={manuscript.requestable ? "Yes" : "No"}
      />
      <MetaField
        label={t("manuscripts.form.subgenres")}
        value={manuscript.subgenres?.join(", ") || "—"}
      />
      <MetaField
        label={t("manuscripts.form.audienceCategories")}
        value={manuscript.audienceCategories?.join(", ") || "—"}
      />
      <MetaField
        label={t("manuscripts.form.declaredThemes")}
        value={manuscript.declaredThemes?.join(", ") || "—"}
      />
      {manuscript.synopsis && (
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("manuscripts.form.synopsis")}
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
            {manuscript.synopsis}
          </dd>
        </div>
      )}
      {manuscript.logline && (
        <TextBlock
          label={t("manuscripts.form.logline")}
          value={manuscript.logline}
        />
      )}
      {manuscript.arcSummary && (
        <TextBlock
          label={t("manuscripts.form.arcSummary")}
          value={manuscript.arcSummary}
        />
      )}
      {manuscript.shortTeaser && (
        <TextBlock
          label={t("manuscripts.form.shortTeaser")}
          value={manuscript.shortTeaser}
        />
      )}
    </dl>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-2 sm:col-span-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
        {value}
      </dd>
    </div>
  );
}
