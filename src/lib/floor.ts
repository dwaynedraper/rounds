/* Rounds — the fixed floor plan (plan §1 #15).
 *
 * Every Best Buy camera department has the same three tables in the same
 * order: Canon (oak island), Nikon (oak island), Sony (grey-marble endcap).
 * This geometry NEVER varies per store — only which camera sits in which
 * slot does (store_positions). So the geometry is a code constant, seeded
 * 1:1 into fixtures/sections/positions, and the renderer draws from here.
 *
 * Orientation convention (locked with Dean, 2026-07-14): sides are named as
 * VIEWED FROM THE END CAP — stand at the end cap looking down the table;
 * "left wall" is on your left, positions run left → right. Sony's 4-camera
 * end sits OPPOSITE the screen end (Dean's illustration is authoritative).
 *
 * Slot grids: every wall section has capacity 5. The 5th slot is the
 * "spread" slot — the UI renders a 4-slot grid until slot idx 4 is
 * assigned, then re-spreads to 5 (empty slots among idx 0–3 keep their
 * spacing). Sony's end section has capacity 4, no spread slot.
 */

export type SideKey = 'left' | 'right' | 'end'

export type FloorSection = {
  /** DB sections.key — unique within a fixture */
  key: string
  side: SideKey
  /** 1-based order along the side, left → right viewed from the end cap */
  nth: number
  label: string
  /** slot capacity (positions seeded per section) */
  capacity: 4 | 5
}

export type FloorTable = {
  /** DB fixtures.slug */
  slug: string
  name: string
  brandSlug: 'canon' | 'nikon' | 'sony'
  surface: 'wood' | 'gray'
  layoutKind: 'plain' | 'endcap'
  sides: { key: SideKey; label: string; sections: FloorSection[] }[]
}

const wallSections = (side: 'left' | 'right'): FloorSection[] => [
  { key: `${side}-1`, side, nth: 1, label: `${cap(side)} wall · section 1`, capacity: 5 },
  { key: `${side}-2`, side, nth: 2, label: `${cap(side)} wall · section 2`, capacity: 5 },
]

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const oakSides: FloorTable['sides'] = [
  { key: 'left', label: 'Left wall', sections: wallSections('left') },
  { key: 'right', label: 'Right wall', sections: wallSections('right') },
]

export const FLOOR: FloorTable[] = [
  {
    slug: 'canon-table',
    name: 'Canon',
    brandSlug: 'canon',
    surface: 'wood',
    layoutKind: 'plain',
    sides: oakSides,
  },
  {
    slug: 'nikon-table',
    name: 'Nikon',
    brandSlug: 'nikon',
    surface: 'wood',
    layoutKind: 'plain',
    sides: oakSides,
  },
  {
    slug: 'sony-table',
    name: 'Sony',
    brandSlug: 'sony',
    surface: 'gray',
    layoutKind: 'endcap',
    sides: [
      {
        key: 'end',
        label: 'End',
        sections: [{ key: 'end-1', side: 'end', nth: 1, label: 'End', capacity: 4 }],
      },
      { key: 'left', label: 'Left wall', sections: wallSections('left') },
      { key: 'right', label: 'Right wall', sections: wallSections('right') },
    ],
  },
]

/** The four flags, exactly (plan §1 #15f). Order is the button order. */
export const FLAG_VOCAB = [
  { key: 'alarm', label: 'Alarm', sort: 1 },
  { key: 'no-power', label: 'No Power', sort: 2 },
  { key: 'broken', label: 'Broken', sort: 3 },
  { key: 'missing', label: 'Missing', sort: 4 },
] as const

export function floorTable(slug: string): FloorTable | undefined {
  return FLOOR.find((t) => t.slug === slug)
}

/** URL segment ↔ table: /store/0148/canon → canon-table */
export function tableByBrand(brandSlug: string): FloorTable | undefined {
  return FLOOR.find((t) => t.brandSlug === brandSlug)
}
