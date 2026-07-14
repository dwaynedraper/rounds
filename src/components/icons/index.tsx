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
  // Aperture — the hero identity mark. Six blades inscribed in a circle.
  aperture: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 L16.5 10.8" />
      <path d="M20.8 14.5 L11.8 14.5" />
      <path d="M16.3 21 L11.8 13.2" />
      <path d="M12 21 L7.5 13.2" />
      <path d="M3.2 9.5 L12.2 9.5" />
      <path d="M7.7 3 L12.2 10.8" />
    </>
  ),
  // Shutter — leaf blades sweeping around a center.
  shutter: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 7.8 4.5L12 12z" />
      <path d="M19.8 16.5A9 9 0 0 1 12 21l0-9z" />
      <path d="M4.2 16.5A9 9 0 0 1 4.2 7.5L12 12z" />
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
