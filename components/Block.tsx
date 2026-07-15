export function Block({
  num,
  title,
  why,
  children,
  accent,
}: {
  num: string;
  title: string;
  why?: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="bg-[var(--surface)] border rounded-[18px] p-6 mt-4"
      style={accent ? { borderColor: "var(--accent-line)", background: "var(--accent-soft)" } : { borderColor: "var(--line)" }}
    >
      <div className="flex gap-3 items-baseline mb-1.5">
        <span className="font-disp font-bold text-[13px] text-white bg-[var(--accent)] w-6 h-6 rounded-[7px] flex items-center justify-center shrink-0 translate-y-[3px]">
          {num}
        </span>
        <h2 className="font-disp font-semibold text-[19px]">{title}</h2>
      </div>
      {why && (
        <p className="text-[13.5px] text-[var(--muted)] mb-4 ml-9 [&_em]:not-italic [&_em]:text-[var(--accent)] [&_em]:font-medium">
          {why}
        </p>
      )}
      {children}
    </div>
  );
}
