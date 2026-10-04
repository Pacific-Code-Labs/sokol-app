import { Button } from "@pacific-code-labs/sokol-design-system";

type Language = "es" | "en";
interface Props {
  value: Language;
  onChange: (next: Language) => void;
  label: string;
  actionLabel: string;
}

/** Current-language flag, with an explicit localized switching action. */
export function CurrentLanguageToggle({ value, onChange, label, actionLabel }: Props) {
  return <div role="group" aria-label={label} className="inline-flex shrink-0">
    <Button variant="outline" size="md" className="h-10 w-10 px-0" aria-label={actionLabel} title={actionLabel}
      onClick={() => onChange(value === "es" ? "en" : "es")}>
      <svg viewBox={value === "es" ? "0 0 30 18" : "0 0 38 20"} aria-hidden="true" data-language={value} className="h-4 w-6 overflow-hidden rounded-sm">
        {value === "es" ? <>
          <path fill="#002B7F" d="M0 0h30v18H0z" /><path fill="#fff" d="M0 3h30v12H0z" /><path fill="#CE1126" d="M0 6h30v6H0z" />
        </> : <>
          <path fill="#fff" d="M0 0h38v20H0z" />
          {Array.from({ length: 7 }, (_, row) => <rect key={row} y={row * 40 / 13} width="38" height={20 / 13} fill="#B22234" />)}
          <path fill="#3C3B6E" d="M0 0h15.2v10.77H0z" />
          {Array.from({ length: 9 }, (_, row) => Array.from({ length: row % 2 ? 5 : 6 }, (_, col) =>
            <path key={`${row}-${col}`} fill="#fff" d="M0 -.65 L.15 -.2 L.62 -.2 L.24 .08 L.38 .53 L0 .25 L-.38 .53 L-.24 .08 L-.62 -.2 L-.15 -.2 Z"
              transform={`translate(${row % 2 ? 2.53 + col * 2.53 : 1.27 + col * 2.53},${.6 + row * 1.2})`} />))}
        </>}
      </svg>
    </Button>
  </div>;
}
