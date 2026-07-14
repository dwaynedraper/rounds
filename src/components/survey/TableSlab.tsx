import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { SectionView, SideView, TableView } from "@/lib/view";
import { visibleSlotCount } from "@/lib/view";

/* The illustration-style table drawing (plan §1 #15e) — approved in the v3
 * mockup. Square textured slab, camera SVGs placed on the section grids and
 * rotated to face outward. This is the config→grid renderer: geometry comes
 * from FLOOR via TableView; nothing here is hand-positioned per store.
 *
 * Orientation: drawn with the screen/TV at the RIGHT end. Viewed from the
 * end cap (left of drawing, looking toward the screen): LEFT wall = top row,
 * RIGHT wall = bottom row. Sony's short end = the left edge column. */

const SURFACES: Record<"wood" | "gray", CSSProperties> = {
  wood: {
    background: [
      "repeating-linear-gradient(180deg, rgba(146,106,52,.10) 0 1px, transparent 1px 7px)",
      "repeating-linear-gradient(180deg, transparent 0 11px, rgba(126,88,40,.07) 11px 13px)",
      "linear-gradient(180deg,#efe0bd,#e7d5ae)",
    ].join(","),
  },
  gray: {
    background: [
      "repeating-linear-gradient(105deg, transparent 0 16px, rgba(116,124,136,.14) 16px 17px, transparent 17px 34px)",
      "repeating-linear-gradient(75deg, transparent 0 26px, rgba(116,124,136,.08) 26px 27px, transparent 27px 52px)",
      "linear-gradient(180deg,#dde1e6,#d2d7dd)",
    ].join(","),
  },
};

const TV_STYLE: CSSProperties = {
  position: "absolute",
  top: "3%",
  bottom: "3%",
  right: 0,
  width: "7%",
  background: "linear-gradient(180deg,#f2f2f2,#a7adb4 32%,#e6e7e9 55%,#82888f 100%)",
  borderLeft: "1px solid #9aa0a6",
};

function CamGlyph({ kind, flagged }: { kind: "camera" | "tablet"; flagged: boolean }) {
  const color = flagged ? "var(--danger)" : "#2e343c";
  if (kind === "tablet") {
    return (
      <svg viewBox="0 0 40 44" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
        <rect x="8" y="6" width="24" height="32" rx="3" fill={color} />
        <rect x="11" y="9" width="18" height="24" rx="1.5" fill="#9fc4e8" />
      </svg>
    );
  }
  // top-down camera, lens pointing down; the wrapper rotates it
  return (
    <svg viewBox="0 0 40 44" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      <rect x="5" y="5" width="30" height="15" rx="2" fill={color} />
      <rect x="26" y="2" width="8" height="5" rx="1.5" fill={color} opacity=".8" />
      <rect x="8" y="8" width="7" height="4" rx="1" fill="#fff" opacity=".25" />
      <circle cx="20" cy="29" r="11" fill={color} />
      <circle cx="20" cy="29" r="6.5" fill="#0e1116" />
      <circle cx="20" cy="29" r="3" fill="#39424e" />
    </svg>
  );
}

type Placed = { xPct: number; yPct: number; rotate: number; slot: SectionView["slots"][number] };

/** Lay a side's sections along [x0,x1] at row y. Grid rule: 4 slots until
 *  the 5th is assigned (visibleSlotCount); empties keep their spacing. */
function placeWall(side: SideView, x0: number, x1: number, yPct: number, rotate: number): Placed[] {
  const placed: Placed[] = [];
  const gap = 1.5;
  const width = (x1 - x0 - gap * (side.sections.length - 1)) / side.sections.length;
  side.sections.forEach((section, si) => {
    const startX = x0 + si * (width + gap);
    const n = visibleSlotCount(section);
    for (let i = 0; i < n; i++) {
      placed.push({ xPct: startX + ((i + 0.5) / n) * width, yPct, rotate, slot: section.slots[i] });
    }
  });
  return placed;
}

function placeEnd(side: SideView, xPct: number): Placed[] {
  const section = side.sections[0];
  const n = section.capacity;
  return Array.from({ length: n }, (_, i) => ({
    xPct,
    yPct: ((i + 0.5) / n) * 100,
    rotate: 90,
    slot: section.slots[i],
  }));
}

export function TableSlab({
  table,
  height,
  camSize = 24,
  zones,
}: {
  table: TableView;
  height: number;
  /** camera glyph size in px */
  camSize?: number;
  /** optional tappable side overlays (single-table view) */
  zones?: { side: "left" | "right" | "end"; href: string; label: string }[];
}) {
  const left = table.sides.find((s) => s.key === "left");
  const right = table.sides.find((s) => s.key === "right");
  const end = table.sides.find((s) => s.key === "end");

  const wallX0 = end ? 15 : 3;
  const wallX1 = 90;
  const placed: Placed[] = [
    ...(left ? placeWall(left, wallX0, wallX1, 24, 180) : []),
    ...(right ? placeWall(right, wallX0, wallX1, 76, 0) : []),
    ...(end ? placeEnd(end, 5.5) : []),
  ];

  const spine: ReactNode = end ? (
    <>
      <div style={{ position: "absolute", left: "11%", width: "2.4%", top: "4%", bottom: "4%", background: "#17191d" }} />
      <div style={{ position: "absolute", left: "11%", right: `${100 - wallX1}%`, top: "47.5%", height: "5%", background: "#17191d" }} />
    </>
  ) : (
    <div style={{ position: "absolute", left: `${wallX0}%`, right: `${100 - wallX1}%`, top: "47%", height: "6%", background: "#fff" }} />
  );

  const zoneRects: Record<"left" | "right" | "end", CSSProperties> = end
    ? {
        end: { left: "1%", width: "10%", top: "3%", bottom: "3%" },
        left: { left: "13%", right: "9%", top: "3%", height: "42%" },
        right: { left: "13%", right: "9%", bottom: "3%", height: "42%" },
      }
    : {
        end: {},
        left: { left: "2%", right: "9%", top: "3%", height: "44%" },
        right: { left: "2%", right: "9%", bottom: "3%", height: "44%" },
      };

  return (
    <div
      className="relative w-full overflow-hidden border border-border-strong"
      style={{ height, ...SURFACES[table.surface] }}
    >
      <div style={TV_STYLE} aria-hidden />
      {spine}
      {placed.map(({ xPct, yPct, rotate, slot }) =>
        slot.name != null ? (
          <div
            key={`${slot.positionId}-${slot.idx}`}
            style={{
              position: "absolute",
              left: `${xPct}%`,
              top: `${yPct}%`,
              width: camSize,
              height: camSize * 1.1,
              transform: `translate(-50%,-50%) rotate(${rotate}deg)`,
              filter: "drop-shadow(0 1px 1px rgba(20,24,31,.25))",
            }}
          >
            <CamGlyph kind={slot.kind} flagged={slot.flags.length > 0} />
            {slot.flags.length > 0 && (
              <div
                aria-hidden
                style={{ position: "absolute", inset: -4, border: "2px solid var(--danger)", borderRadius: "50%" }}
              />
            )}
          </div>
        ) : (
          <div
            key={`empty-${slot.positionId}-${slot.idx}-${xPct}`}
            aria-hidden
            style={{
              position: "absolute",
              left: `${xPct}%`,
              top: `${yPct}%`,
              width: camSize * 0.8,
              height: camSize * 0.8,
              transform: "translate(-50%,-50%)",
              border: "1.5px dashed rgba(20,24,31,.3)",
            }}
          />
        ),
      )}
      {zones?.map((zone) => (
        <Link
          key={zone.side}
          href={zone.href}
          className="absolute border-2 border-transparent hover:border-info focus-visible:border-info"
          style={zoneRects[zone.side]}
        >
          <span className="absolute left-1 top-1 border border-info bg-bg/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-info-text">
            {zone.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
