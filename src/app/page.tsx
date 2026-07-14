"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const [number, setNumber] = useState("");
  const router = useRouter();
  const valid = /^\d{4}$/.test(number);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (valid) router.push(`/store/${number}`);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-16">
      <div className="mb-6 flex items-center gap-2">
        <Icon name="aperture" size={30} />
        <h1 className="text-2xl font-semibold">Rounds</h1>
      </div>
      <p className="mb-6 text-sm text-text-muted">
        Enter your store number to walk the camera tables and report what&apos;s
        broken, missing, or out of place.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="Store number"
          mono
          inputMode="numeric"
          maxLength={4}
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="0058"
          hint="4-digit Best Buy store number"
        />
        <Button type="submit" block disabled={!valid} iconRight="chevron-right">
          Start round
        </Button>
      </form>
    </main>
  );
}
