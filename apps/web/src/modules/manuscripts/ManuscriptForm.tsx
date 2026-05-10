import { useTranslation } from "react-i18next";
import type { CreateManuscriptRequest } from "@marketplace/contracts";
import { NumberInput, TextareaInput, TextInput } from "./ManuscriptFormFields";
import { useManuscriptFormState } from "./useManuscriptFormState";

type Props = {
  defaultValues?: Partial<CreateManuscriptRequest>;
  onSubmit: (values: CreateManuscriptRequest) => void | Promise<void>;
  onCancel?: () => void;
  isSaving?: boolean;
};

const LANGUAGE_OPTIONS = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

export function ManuscriptForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSaving,
}: Props) {
  const { t } = useTranslation();
  const {
    arcSummary,
    audienceCategories,
    compTitles,
    declaredContentWarnings,
    declaredThemes,
    errors,
    genre,
    handleSubmit,
    language,
    logline,
    manuscriptForm,
    requestable,
    setArcSummary,
    setAudienceCategories,
    setCompTitles,
    setDeclaredContentWarnings,
    setDeclaredThemes,
    setGenre,
    setLanguage,
    setLogline,
    setManuscriptForm,
    setRequestable,
    setShortTeaser,
    setSubgenres,
    setSynopsis,
    setTargetAgeMax,
    setTargetAgeMin,
    setTitle,
    setWordCount,
    shortTeaser,
    subgenres,
    synopsis,
    targetAgeMax,
    targetAgeMin,
    title,
    wordCount,
  } = useManuscriptFormState({ defaultValues, onSubmit });

  const inputClass =
    "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600";
  const labelClass =
    "block text-xs font-semibold uppercase tracking-wider text-slate-500";

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      noValidate
    >
      <div className="sm:col-span-2">
        <TextInput
          id="manuscript-title"
          inputClass={inputClass}
          label={t("manuscripts.form.title")}
          labelClass={labelClass}
          maxLength={200}
          onChange={setTitle}
          placeholder={t("manuscripts.form.titlePlaceholder")}
          required
          value={title}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-red-600">{errors.title}</p>
        )}
      </div>

      <div>
        <TextInput
          id="manuscript-genre"
          inputClass={inputClass}
          label={t("manuscripts.form.genre")}
          labelClass={labelClass}
          maxLength={80}
          onChange={setGenre}
          placeholder={t("manuscripts.form.genrePlaceholder")}
          required
          value={genre}
        />
        {errors.genre && (
          <p className="mt-1 text-xs text-red-600">{errors.genre}</p>
        )}
      </div>

      {/* Language */}
      <div>
        <label htmlFor="manuscript-language" className={labelClass}>
          {t("manuscripts.form.language")}
          <span className="ml-1 text-red-500">*</span>
        </label>
        <select
          id="manuscript-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className={inputClass}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <NumberInput
        id="manuscript-word-count"
        inputClass={inputClass}
        label={t("manuscripts.form.wordCount")}
        labelClass={labelClass}
        min={0}
        onChange={setWordCount}
        value={wordCount}
      />

      <NumberInput
        id="manuscript-age-min"
        inputClass={inputClass}
        label={t("manuscripts.form.targetAgeMin")}
        labelClass={labelClass}
        max={120}
        min={0}
        onChange={setTargetAgeMin}
        value={targetAgeMin}
      />

      <NumberInput
        id="manuscript-age-max"
        inputClass={inputClass}
        label={t("manuscripts.form.targetAgeMax")}
        labelClass={labelClass}
        max={120}
        min={0}
        onChange={setTargetAgeMax}
        value={targetAgeMax}
      />

      <TextareaInput
        id="manuscript-synopsis"
        inputClass={inputClass}
        label={t("manuscripts.form.synopsis")}
        labelClass={labelClass}
        maxLength={2000}
        onChange={setSynopsis}
        placeholder={t("manuscripts.form.synopsisPlaceholder")}
        rows={4}
        value={synopsis}
      />

      <div className="sm:col-span-2">
        <TextInput
          id="manuscript-logline"
          inputClass={inputClass}
          label={t("manuscripts.form.logline")}
          labelClass={labelClass}
          maxLength={500}
          onChange={setLogline}
          value={logline}
        />
      </div>

      <TextInput
        id="manuscript-subgenres"
        inputClass={inputClass}
        label={t("manuscripts.form.subgenres")}
        labelClass={labelClass}
        onChange={setSubgenres}
        value={subgenres}
      />
      <TextInput
        id="manuscript-audience"
        inputClass={inputClass}
        label={t("manuscripts.form.audienceCategories")}
        labelClass={labelClass}
        onChange={setAudienceCategories}
        value={audienceCategories}
      />
      <TextInput
        id="manuscript-form"
        inputClass={inputClass}
        label={t("manuscripts.form.manuscriptForm")}
        labelClass={labelClass}
        onChange={setManuscriptForm}
        value={manuscriptForm}
      />
      <TextInput
        id="manuscript-comp-titles"
        inputClass={inputClass}
        label={t("manuscripts.form.compTitles")}
        labelClass={labelClass}
        onChange={setCompTitles}
        value={compTitles}
      />
      <TextInput
        id="manuscript-themes"
        inputClass={inputClass}
        label={t("manuscripts.form.declaredThemes")}
        labelClass={labelClass}
        onChange={setDeclaredThemes}
        value={declaredThemes}
      />
      <TextInput
        id="manuscript-warnings"
        inputClass={inputClass}
        label={t("manuscripts.form.declaredContentWarnings")}
        labelClass={labelClass}
        onChange={setDeclaredContentWarnings}
        value={declaredContentWarnings}
      />

      <TextareaInput
        id="manuscript-arc"
        inputClass={inputClass}
        label={t("manuscripts.form.arcSummary")}
        labelClass={labelClass}
        maxLength={2000}
        onChange={setArcSummary}
        rows={4}
        value={arcSummary}
      />

      <div className="sm:col-span-2">
        <TextareaInput
          id="manuscript-teaser"
          inputClass={inputClass}
          label={t("manuscripts.form.shortTeaser")}
          labelClass={labelClass}
          maxLength={500}
          onChange={setShortTeaser}
          rows={3}
          value={shortTeaser}
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            checked={requestable}
            onChange={(e) => setRequestable(e.target.checked)}
            type="checkbox"
          />
          {t("manuscripts.form.requestable")}
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 sm:col-span-2">
        <button
          type="submit"
          id="manuscript-save-btn"
          disabled={isSaving}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isSaving ? t("manuscripts.form.saving") : t("manuscripts.form.save")}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {t("manuscripts.form.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
