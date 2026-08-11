import type { SVGProps } from "react";

/* Rounds — hand-rolled icon set (Phase 1). No icon library (plan §2).
   Technical line style: 24×24 grid, currentColor stroke, precise.
   The camera glyphs (aperture, shutter, lens) are the visual identity. */

export type IconName =
  | "aperture"
  | "shutter"
  | "lens"
  | "camera"
  | "flag"
  | "check"
  | "x"
  | "plus"
  | "minus"
  | "chevron-right"
  | "chevron-down"
  | "search"
  | "alert"
  | "slot"
  | "grid"
  | "store"
  | "clock"
  | "edit"
  | "trash"
  | "cloud-check"
  | "cloud-pending";

// Each entry draws inside a 0 0 24 24 viewBox, fill:none, stroke:currentColor.
const GLYPHS: Record<IconName, React.ReactNode> = {
  // Aperture — the hero identity mark. A real iris diaphragm: six blades
  // closing onto a hexagonal opening. Geometry is computed, not eyeballed —
  // inner hexagon r=4 with a vertex at 12 o'clock, and each blade edge runs
  // from its vertex out to the circle 60° around, which is what produces the
  // pinwheel an actual iris makes. (Dean's note, 2026-07-24: the previous
  // glyph was six unrelated chords and read as a bicycle wheel.)
  aperture: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8 L15.46 10 L15.46 14 L12 16 L8.54 14 L8.54 10 Z" />
      <path d="M12 8 L19.79 7.5" />
      <path d="M15.46 10 L19.79 16.5" />
      <path d="M15.46 14 L12 21" />
      <path d="M12 16 L4.21 16.5" />
      <path d="M8.54 14 L4.21 7.5" />
      <path d="M8.54 10 L12 3" />
    </>
  ),
  // Shutter — an orthographic short, wide cylinder: the shutter drum, seen
  // slightly from above so the top face reads as an ellipse. Vertical ticks
  // on the barrel are the blade seams (and double as dial knurling). Chosen
  // over leaf-blades-on-a-circle so it is instantly distinguishable from the
  // aperture glyph above at 24px — the old one was the same circle with
  // fewer lines. (Dean's direction, 2026-07-24.)
  shutter: (
    <>
      <ellipse cx="12" cy="7.5" rx="9" ry="3.5" />
      <path d="M3 7.5v9" />
      <path d="M21 7.5v9" />
      <path d="M3 16.5a9 3.5 0 0 0 18 0" />
      <path d="M7.5 10.6v6.9" />
      <path d="M12 11v7.5" />
      <path d="M16.5 10.6v6.9" />
    </>
  ),
  // Lens — concentric optic.
  lens: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M9 9.2a4.5 4.5 0 0 1 2.2-1.4" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5h3l1.5-2h7L17 8.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2 3.5 2 3.5H6" />
    </>
  ),
  check: <path d="M4.5 12.5 L9.5 17.5 L19.5 6.5" />,
  x: (
    <>
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5 V19" />
      <path d="M5 12 H19" />
    </>
  ),
  minus: <path d="M5 12 H19" />,
  "chevron-right": <path d="M9 5 L16 12 L9 19" />,
  "chevron-down": <path d="M5 9 L12 16 L19 9" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16 L21 21" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 L22 20 H2 Z" />
      <path d="M12 9 V14" />
      <path d="M12 17 h.01" />
    </>
  ),
  slot: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5V20h16V9.5" />
      <path d="M3 9.5 4.5 4h15L21 9.5a2.5 2.5 0 0 1-4.5 1.5 2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0A2.5 2.5 0 0 1 3 9.5z" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7 V12 L15.5 14" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6 L18 10" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6 7l1 13h10l1-13" />
    </>
  ),
  "cloud-check": (
    <>
      <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a3.75 3.75 0 0 1 .5 8.5H7z" />
      <path d="M9.5 13.5 L11.5 15.5 L15 11.5" />
    </>
  ),
  "cloud-pending": (
    <>
      <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a3.75 3.75 0 0 1 .5 8.5H7z" />
      <path d="M9.5 14h5" />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** pixel size for width & height; default 20 */
  size?: number;
  /** stroke width in SVG units; default 1.75 */
  weight?: number;
}

export function Icon({ name, size = 20, weight = 1.75, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {GLYPHS[name]}
    </svg>
  );
}
