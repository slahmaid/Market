import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  /** Tailwind max-width class. Default max-w-xl */
  maxWidthClassName?: string;
  className?: string;
};

/**
 * Shared content container: horizontal padding, FAB clearance on mobile.
 */
export function PageShell({
  children,
  maxWidthClassName = "max-w-xl",
  className = "",
}: PageShellProps) {
  return (
    <div
      className={`mx-auto w-full ${maxWidthClassName} px-4 py-6 sm:px-6 sm:py-8 pb-[calc(5.5rem+var(--safe-bottom))] md:pb-8 ${className}`}
    >
      {children}
    </div>
  );
}
