import type { ReactNode } from "react";

type AuthShellProps = {
  badge: string;
  title: string;
  description: string;
  points: string[];
  children: ReactNode;
};

export function AuthShell({
  badge,
  title,
  description,
  points,
  children,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,115,53,0.08),transparent_24%)]" />

      <div className="relative z-10 grid w-full max-w-6xl gap-12 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
        <section className="mx-auto w-full max-w-xl space-y-8 xl:mx-0">
          <div className="inline-flex rounded-full border border-white bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            {badge}
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-lg text-base leading-8 text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="space-y-3">
            {points.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-foreground/84">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="leading-7">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-center xl:justify-end">{children}</div>
      </div>
    </main>
  );
}
