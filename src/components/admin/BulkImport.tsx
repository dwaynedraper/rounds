"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importProducts, type ImportResult } from "@/app/admin/products/import/actions";
import { bulkProductRow } from "@/lib/contracts";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/Chip";

const COLS = ["brandSlug", "quickName", "longName", "model", "sku", "kind"] as const;

type ParsedRow = { line: number; data: Record<string, string>; ok: boolean; error?: string };

function parse(text: string): ParsedRow[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const cells = line.split("\t").length > 1 ? line.split("\t") : line.split(",");
      const data = Object.fromEntries(COLS.map((c, idx) => [c, (cells[idx] ?? "").trim()]));
      const check = bulkProductRow.safeParse(data);
      return { line: i + 1, data, ok: check.success, error: check.success ? undefined : check.error.issues[0]?.message };
    });
}

export function BulkImport() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const validRows = rows?.filter((r) => r.ok) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Paste rows, one product per line, tab- or comma-separated in this column order:
        <span className="tabular mt-1 block text-xs text-text">{COLS.join(" · ")}</span>
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setRows(null); setResult(null); }}
        rows={8}
        placeholder="sony	A7 V	Alpha 7 V	ILCE-7M5	1234567	camera"
        className="tabular w-full rounded-none border border-border-strong bg-bg p-3 text-sm"
      />
      <div className="flex gap-2">
        <Button variant="secondary" icon="search" onClick={() => setRows(parse(text))} disabled={!text.trim()}>
          Preview
        </Button>
        {validRows.length > 0 && !result && (
          <Button
            icon="check"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await importProducts(validRows.map((r) => r.data));
              setResult(res);
              setBusy(false);
              router.refresh();
            }}
          >
            {busy ? "Importing…" : `Import ${validRows.length} valid`}
          </Button>
        )}
      </div>

      {result && (
        <div className="border border-success bg-success/10 p-3 text-sm">
          Imported {result.inserted}. {result.skipped.length > 0 && `${result.skipped.length} skipped.`}
          {result.skipped.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-danger-text">
              {result.skipped.map((s, i) => (
                <li key={i}>line {s.line}: {s.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows && !result && (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-2xs uppercase text-text-muted">
                <th className="px-2 py-1.5">#</th>
                {COLS.map((c) => <th key={c} className="px-2 py-1.5">{c}</th>)}
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line} className="border-b border-border last:border-0">
                  <td className="tabular px-2 py-1.5 text-text-faint">{r.line}</td>
                  {COLS.map((c) => <td key={c} className="tabular px-2 py-1.5">{r.data[c]}</td>)}
                  <td className="px-2 py-1.5">
                    {r.ok ? <StatusChip tone="success">ok</StatusChip> : <StatusChip tone="danger">{r.error}</StatusChip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
