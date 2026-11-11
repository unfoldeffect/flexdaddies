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

// Bathroom scale: square platform with a dial window and needle.
export function ScaleIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M7.5 9a4.5 4.5 0 0 1 9 0Z" />
      <path d="M12 9l1.6-2.4" />
    </svg>
  );
}

export function EditIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

export function GripIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className} strokeWidth={2.6}>
      <path d="M5 9h14M5 15h14" />
    </svg>
  );
}

export function GearIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function SearchIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function CheckIcon({ size, color, className }: IconProps) {
  return (
    <svg {...base(size)} color={color} className={className} strokeWidth={3}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
