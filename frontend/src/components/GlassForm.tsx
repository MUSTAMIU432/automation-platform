import type { ComponentType, ReactNode } from "react";

/** Soft colour behind the glass, so the blur has something to blur. */
export function GlassBackdropBlobs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
    >
      <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-brand-200/70 blur-3xl" />
      <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-sky-200/60 blur-3xl" />
      <div className="absolute top-1/3 left-1/3 h-40 w-40 rounded-full bg-emerald-100/70 blur-3xl" />
    </div>
  );
}

/** The form's title row: a glossy icon tile, the heading and what it is for. */
export function GlassFormHeader({
  Glyph,
  title,
  children,
}: {
  Glyph: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_10px_24px_-10px_rgba(20,99,73,0.7)]">
        <Glyph className="h-6 w-6" />
      </span>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">{children}</p>
      </div>
    </div>
  );
}
