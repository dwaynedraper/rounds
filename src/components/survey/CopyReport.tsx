"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Copy-to-clipboard for the store report (plan Phase 3). The report text is
 *  built server-side from the same cached reads that render the page. */
export function CopyReport({ report }: { report: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      block
      variant="secondary"
      icon={copied ? "check" : "edit"}
      onClick={async () => {
        await navigator.clipboard.writeText(report);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy report"}
    </Button>
  );
}
