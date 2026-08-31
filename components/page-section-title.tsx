export function PageSectionTitle({
  eyebrow,
  title,
  subtitle,
  level = 'h2'
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  level?: 'h1' | 'h2';
}) {
  const Heading = level;

  return (
    <div className="page-section-title mb-8 flex flex-col gap-3">
      <div className="page-section-title-eyebrow eyebrow w-fit">{eyebrow}</div>
      <div className="page-section-title-copy">
        <Heading className="page-section-title-heading title-balance text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</Heading>
        <p className="page-section-title-subtitle mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">{subtitle}</p>
      </div>
    </div>
  );
}
