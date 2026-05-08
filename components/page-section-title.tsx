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
    <div className="mb-8 flex flex-col gap-3">
      <div className="eyebrow w-fit">{eyebrow}</div>
      <div>
        <Heading className="title-balance text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</Heading>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">{subtitle}</p>
      </div>
    </div>
  );
}
