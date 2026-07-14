"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useStoreData, type CatalogPayload, type StoreData } from "@/lib/client-data";
import { buildTableViews, type TableView } from "@/lib/view";
import { CreateStore } from "@/components/survey/CreateStore";

/* Shared client shell for the survey pages: loads catalog + store state
 * through the §5 GET endpoints and hands built TableViews to the page.
 * Loading/missing/error states live here so every survey screen behaves
 * identically. See client-data.ts for why the survey is client-fetched. */

export function StoreShell({
  number,
  children,
}: {
  number: string;
  children: (tables: TableView[], nickname: string | null, catalog: CatalogPayload) => ReactNode;
}) {
  const { data, reload } = useStoreData(number);
  return <StoreShellView number={number} data={data} reload={reload} render={children} />;
}

function StoreShellView({
  number,
  data,
  reload,
  render,
}: {
  number: string;
  data: StoreData;
  reload: () => void;
  render: (tables: TableView[], nickname: string | null, catalog: CatalogPayload) => ReactNode;
}) {
  if (!/^\d{4}$/.test(number)) {
    return (
      <Centered>
        <p className="text-lg font-semibold">That&apos;s not a store number</p>
        <BackHome />
      </Centered>
    );
  }

  switch (data.status) {
    case "loading":
      return (
        <Centered>
          <p className="text-sm font-semibold text-text-muted" role="status">
            Loading store {number}…
          </p>
        </Centered>
      );
    case "missing":
      return (
        <Centered>
          <p className="text-lg font-semibold">Store {number} isn&apos;t set up yet</p>
          <p className="mb-4 mt-1 text-sm text-text-muted">One tap creates it — no admin needed.</p>
          <CreateStore number={number} onCreated={reload} />
          <BackHome label="Different store" />
        </Centered>
      );
    case "error":
      return (
        <Centered>
          <p className="text-lg font-semibold">Couldn&apos;t load store {number}</p>
          <p className="mb-4 mt-1 text-sm text-danger-text">{data.message}</p>
          <button
            type="button"
            onClick={reload}
            className="border-2 border-border-strong px-4 py-2 text-sm font-bold hover:bg-surface"
          >
            Try again
          </button>
          <BackHome />
        </Centered>
      );
    case "ready":
      return <>{render(buildTableViews(data.catalog, data.state), data.state.store.nickname, data.catalog)}</>;
  }
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-sm px-4 py-16 text-center">{children}</main>;
}

function BackHome({ label = "Back" }: { label?: string }) {
  return (
    <Link href="/" className="mt-4 inline-block text-sm text-info-text underline">
      {label}
    </Link>
  );
}
