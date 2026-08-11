// Rounds — issue report format (plan §1 #20).
//
// Dean specified this output exactly, from the floor. It is the thing reps
// paste into a text or an email at the end of a walk, so the format IS the
// feature — these tests pin it character for character. Pure function, no DB,
// no network.
import { describe, test, expect } from "vitest";
import { buildReport, type TableView, type SectionView } from "../src/lib/view";

function section(slots: Array<{ name: string | null; flags: string[]; note?: string }>): SectionView {
  return {
    key: "left-1",
    label: "Left wall",
    capacity: 4,
    // buildTableViews always emits exactly `capacity` slots, empties
    // included — pad so the fixture matches what production produces.
    slots: [...slots, ...Array(Math.max(0, 4 - slots.length)).fill({ name: null, flags: [] })].map((s, idx) => ({
      positionId: idx + 1,
      idx,
      productId: s.name ? idx + 1 : null,
      name: s.name,
      kind: "camera" as const,
      flags: s.flags,
      note: s.note ?? "",
      capturedAt: null,
    })),
  };
}

function table(
  name: string,
  brandSlug: "canon" | "nikon" | "sony",
  slots: Array<{ name: string | null; flags: string[]; note?: string }>,
): TableView {
  return {
    slug: `${brandSlug}-table`,
    brandSlug,
    name,
    surface: "wood",
    sides: [{ key: "left", label: "Left wall", sections: [section(slots)] }],
    flagCount: slots.filter((s) => s.flags.length > 0).length,
  };
}

describe("buildReport", () => {
  test("brand + quick name only — no wall labels, no position numbers", () => {
    const report = buildReport("0148", null, [
      table("Canon", "canon", [
        { name: "EOS R", flags: ["missing", "broken"] },
        { name: "EOS R8", flags: ["no-power"] },
        { name: "EOS R7", flags: ["broken"] },
      ]),
    ]);

    // This is Dean's specification, verbatim.
    expect(report).toBe(
      ["Store 0148", "Canon EOS R: missing, broken", "Canon EOS R8: no-power", "Canon EOS R7: broken"].join("\n"),
    );
  });

  test("a note follows the flags on the same line", () => {
    const report = buildReport("0148", null, [
      table("Nikon", "nikon", [
        { name: "Z30", flags: ["alarm", "missing"], note: "Loose from the mount, told MOD" },
        { name: "Z50", flags: ["alarm"] },
      ]),
    ]);

    expect(report).toBe(
      [
        "Store 0148",
        "Nikon Z30: alarm, missing — Loose from the mount, told MOD",
        "Nikon Z50: alarm",
      ].join("\n"),
    );
  });

  test("unflagged and empty slots never appear — the report is issues only", () => {
    const report = buildReport("0148", null, [
      table("Sony", "sony", [
        { name: "A7 V", flags: [] }, // fine, so not an issue
        { name: null, flags: [] }, // empty slot
        { name: "A6700", flags: ["broken"] },
      ]),
    ]);

    expect(report).toBe(["Store 0148", "Sony A6700: broken"].join("\n"));
  });

  test("a clean store says so rather than returning a bare header", () => {
    const report = buildReport("0148", null, [table("Canon", "canon", [{ name: "EOS R", flags: [] }])]);
    expect(report).toBe(["Store 0148", "No issues found."].join("\n"));
  });

  test("a store nickname, when set, rides in the header", () => {
    const report = buildReport("0148", "Southcenter", [
      table("Canon", "canon", [{ name: "EOS R", flags: ["broken"] }]),
    ]);
    expect(report.split("\n")[0]).toBe("Store 0148 (Southcenter)");
  });

  test("no blank line between the header and the first camera", () => {
    const report = buildReport("0148", null, [
      table("Canon", "canon", [{ name: "EOS R", flags: ["broken"] }]),
    ]);
    expect(report.split("\n")[1]).toBe("Canon EOS R: broken");
  });
});
