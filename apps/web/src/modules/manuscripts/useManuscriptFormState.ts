import { useState, type FormEvent } from "react";
import type { CreateManuscriptRequest } from "@marketplace/contracts";

type FormErrors = Partial<Record<"title" | "genre" | "language", string>>;

type UseManuscriptFormStateArgs = {
  defaultValues?: Partial<CreateManuscriptRequest>;
  onSubmit: (values: CreateManuscriptRequest) => void | Promise<void>;
};

export function useManuscriptFormState({
  defaultValues,
  onSubmit,
}: UseManuscriptFormStateArgs) {
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [genre, setGenre] = useState(defaultValues?.genre ?? "");
  const [language, setLanguage] = useState(defaultValues?.language ?? "tr");
  const [wordCount, setWordCount] = useState<string>(
    defaultValues?.wordCount?.toString() ?? "",
  );
  const [synopsis, setSynopsis] = useState(defaultValues?.synopsis ?? "");
  const [logline, setLogline] = useState(defaultValues?.logline ?? "");
  const [subgenres, setSubgenres] = useState(
    defaultValues?.subgenres?.join(", ") ?? "",
  );
  const [audienceCategories, setAudienceCategories] = useState(
    defaultValues?.audienceCategories?.join(", ") ?? "",
  );
  const [manuscriptForm, setManuscriptForm] = useState(
    defaultValues?.manuscriptForm ?? "",
  );
  const [compTitles, setCompTitles] = useState(
    defaultValues?.compTitles?.join(", ") ?? "",
  );
  const [declaredThemes, setDeclaredThemes] = useState(
    defaultValues?.declaredThemes?.join(", ") ?? "",
  );
  const [declaredContentWarnings, setDeclaredContentWarnings] = useState(
    defaultValues?.declaredContentWarnings?.join(", ") ?? "",
  );
  const [arcSummary, setArcSummary] = useState(defaultValues?.arcSummary ?? "");
  const [shortTeaser, setShortTeaser] = useState(
    defaultValues?.shortTeaser ?? "",
  );
  const [requestable, setRequestable] = useState(
    defaultValues?.requestable ?? false,
  );
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    void onSubmit({
      title: title.trim(),
      genre: genre.trim(),
      language: language.trim(),
      wordCount: wordCount ? Number(wordCount) : undefined,
      synopsis: synopsis.trim() || undefined,
      logline: logline.trim() || undefined,
      subgenres: splitCsv(subgenres),
      audienceCategories: splitCsv(audienceCategories),
      manuscriptForm: manuscriptForm.trim() || undefined,
      compTitles: splitCsv(compTitles),
      declaredThemes: splitCsv(declaredThemes),
      declaredContentWarnings: splitCsv(declaredContentWarnings),
      arcSummary: arcSummary.trim() || undefined,
      shortTeaser: shortTeaser.trim() || undefined,
      requestable,
      targetAgeMin: targetAgeMin ? Number(targetAgeMin) : undefined,
      targetAgeMax: targetAgeMax ? Number(targetAgeMax) : undefined,
    });
  }

  return {
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
  };
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
