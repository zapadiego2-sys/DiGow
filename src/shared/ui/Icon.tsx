const PATHS = {
  check: 'M5 13l4 4L19 7',
  chevronDown: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  document: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  plus: 'M12 5v14M5 12h14',
  print: 'M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7z',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1V5h-6v2L7 8 5 7l-2 4 2 1v0l-2 1 2 4 2-1 2 1v2h6v-2l2-1 2 1 2-4z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
} as const;

export type IconName = keyof typeof PATHS;

/** Ícono decorativo: el nombre accesible lo aporta el control que lo contiene. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-lg shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
