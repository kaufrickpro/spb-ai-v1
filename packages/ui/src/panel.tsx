import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  children: ReactNode;
};

export function buildPanelClassName(baseClass = "panel"): string {
  return `${baseClass} panel--scaffold`;
}

export function Panel({ title, children }: PanelProps) {
  return (
    <section className={buildPanelClassName()}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
