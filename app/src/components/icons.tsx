type IconProps = { size?: number; color?: string; className?: string };

const base = (size: number | undefined) => ({
  width: size ?? 20,
  height: size ?? 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function DumbbellIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M4 8v8M2 10v4" />
      <path d="M20 8v8M22 10v4" />
      <path d="M7 12h10" />
      <path d="M6.5 9.5v5M17.5 9.5v5" />
    </svg>
  );
}

export function HistoryIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function BarChartIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </svg>
  );
}

export function UserIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.4-3.6 4.2-5.5 7-5.5S18.6 16.4 20 20" />
    </svg>
  );
}

export function PlusIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function XIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronDownIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ChevronUpIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

export function TrashIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
