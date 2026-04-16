export function PageSectionTitle({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      <div className="eyebrow w-fit">{eyebrow}</div>
      <div>
        <h2 className="title-balance text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">{subtitle}</p>
      </div>
    </div>
  );
}
