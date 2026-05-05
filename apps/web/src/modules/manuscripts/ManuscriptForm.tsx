import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CreateManuscriptRequest } from "@marketplace/contracts";

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

type FormErrors = Partial<Record<"title" | "genre" | "language", string>>;

export function ManuscriptForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSaving,
}: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [genre, setGenre] = useState(defaultValues?.genre ?? "");
  const [language, setLanguage] = useState(defaultValues?.language ?? "tr");
  const [wordCount, setWordCount] = useState<string>(
    defaultValues?.wordCount?.toString() ?? "",
  );
  const [synopsis, setSynopsis] = useState(defaultValues?.synopsis ?? "");
  const [targetAgeMin, setTargetAgeMin] = useState<string>(
    defaultValues?.targetAgeMin?.toString() ?? "",
  );
  const [targetAgeMax, setTargetAgeMax] = useState<string>(
    defaultValues?.targetAgeMax?.toString() ?? "",
  );
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): boolean {
    const next: FormErrors = {};
    if (!title.trim()) next.title = "Title is required.";
    if (!genre.trim()) next.genre = "Genre is required.";
    if (!language.trim()) next.language = "Language is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    void onSubmit({
      title: title.trim(),
      genre: genre.trim(),
      language: language.trim(),
      wordCount: wordCount ? Number(wordCount) : undefined,
      synopsis: synopsis.trim() || undefined,
      targetAgeMin: targetAgeMin ? Number(targetAgeMin) : undefined,
      targetAgeMax: targetAgeMax ? Number(targetAgeMax) : undefined,
    });
  }

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
      {/* Title */}
      <div className="sm:col-span-2">
        <label htmlFor="manuscript-title" className={labelClass}>
          {t("manuscripts.form.title")}
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="manuscript-title"
          type="text"
          placeholder={t("manuscripts.form.titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className={inputClass}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-red-600">{errors.title}</p>
        )}
      </div>

      {/* Genre */}
      <div>
        <label htmlFor="manuscript-genre" className={labelClass}>
          {t("manuscripts.form.genre")}
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="manuscript-genre"
          type="text"
          placeholder={t("manuscripts.form.genrePlaceholder")}
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          maxLength={80}
          className={inputClass}
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

      {/* Word count */}
      <div>
        <label htmlFor="manuscript-word-count" className={labelClass}>
          {t("manuscripts.form.wordCount")}
        </label>
        <input
          id="manuscript-word-count"
          type="number"
          min={0}
          value={wordCount}
          onChange={(e) => setWordCount(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Target age min */}
      <div>
        <label htmlFor="manuscript-age-min" className={labelClass}>
          {t("manuscripts.form.targetAgeMin")}
        </label>
        <input
          id="manuscript-age-min"
          type="number"
          min={0}
          max={120}
          value={targetAgeMin}
          onChange={(e) => setTargetAgeMin(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Target age max */}
      <div>
        <label htmlFor="manuscript-age-max" className={labelClass}>
          {t("manuscripts.form.targetAgeMax")}
        </label>
        <input
          id="manuscript-age-max"
          type="number"
          min={0}
          max={120}
          value={targetAgeMax}
          onChange={(e) => setTargetAgeMax(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Synopsis */}
      <div className="sm:col-span-2">
        <label htmlFor="manuscript-synopsis" className={labelClass}>
          {t("manuscripts.form.synopsis")}
        </label>
        <textarea
          id="manuscript-synopsis"
          rows={4}
          placeholder={t("manuscripts.form.synopsisPlaceholder")}
          maxLength={2000}
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          className={inputClass}
        />
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
