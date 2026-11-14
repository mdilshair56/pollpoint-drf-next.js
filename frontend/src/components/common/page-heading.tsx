import type { ReactNode } from "react";

type PageHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: PageHeadingProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm font-semibold text-interactive">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-brand">{title}</h1>
        {description && <p className="mt-2 text-slate-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
