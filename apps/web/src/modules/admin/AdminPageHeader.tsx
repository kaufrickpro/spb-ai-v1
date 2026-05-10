type AdminPageHeaderProps = {
  kicker: string;
  title: string;
  subtitle: string;
};

export function AdminPageHeader({
  kicker,
  title,
  subtitle,
}: AdminPageHeaderProps) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{kicker}</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}
