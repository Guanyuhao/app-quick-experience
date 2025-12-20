import type { ReactNode } from "react";

export type DownloadButtonVariant = "emerald" | "red" | "slate" | "indigo";

interface DownloadButtonProps {
  downloadUrl: string;
  btnText: string;
  variant?: DownloadButtonVariant;
  icon?: ReactNode;
  showDownloadIcon?: boolean;
  className?: string;
}

const variantStyles: Record<DownloadButtonVariant, string> = {
  emerald:
    "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300",
  red: "bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300",
  slate:
    "bg-slate-500/20 text-slate-300 hover:bg-slate-500/30 hover:text-slate-200",
  indigo:
    "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 hover:text-indigo-300",
};

// 默认图标
const DefaultDownloadIcon = () => (
  <svg
    className="h-4 w-4 opacity-60"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

export function DownloadButton({
  downloadUrl,
  btnText,
  variant = "emerald",
  icon,
  showDownloadIcon = true,
  className = "",
}: DownloadButtonProps) {
  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${variantStyles[variant]} ${className}`}
    >
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <span>{btnText}</span>
      {showDownloadIcon && <DefaultDownloadIcon />}
    </a>
  );
}

