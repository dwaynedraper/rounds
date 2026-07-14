"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/app/admin/products/actions";
import { Button } from "@/components/ui/Button";

// Two-click confirm (no native dialog): first click arms, second deletes.
export function DeleteProductButton({ id }: { id: number }) {
  const [armed, setArmed] = useState(false);
  const router = useRouter();
  return armed ? (
    <span className="inline-flex gap-1">
      <Button
        size="sm"
        variant="danger"
        onClick={async () => {
          await deleteProduct(id);
          router.refresh();
        }}
      >
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  ) : (
    <Button size="sm" variant="ghost" icon="trash" onClick={() => setArmed(true)}>
      Delete
    </Button>
  );
}
