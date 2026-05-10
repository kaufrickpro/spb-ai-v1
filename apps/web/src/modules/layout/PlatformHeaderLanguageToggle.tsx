import { useTranslation } from "react-i18next";

export function PlatformHeaderLanguageToggle({
  className,
}: {
  className?: string;
}) {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className={className ?? ""}>
      <div className="inline-flex items-center gap-1 rounded-md border border-white/30 p-1">
        <button
          type="button"
          onClick={() => void i18n.changeLanguage("tr")}
          data-active={activeLanguage.startsWith("tr")}
          className="rounded px-2 py-1 text-xs font-medium data-[active=true]:bg-white data-[active=true]:text-slate-900"
        >
          TR
        </button>
        <button
          type="button"
          onClick={() => void i18n.changeLanguage("en")}
          data-active={activeLanguage.startsWith("en")}
          className="rounded px-2 py-1 text-xs font-medium data-[active=true]:bg-white data-[active=true]:text-slate-900"
        >
          EN
        </button>
      </div>
    </div>
  );
}
