"use client";

import { Button } from "@/components/ui/button";

export default function AuthedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Đã xảy ra lỗi</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message ?? "Lỗi không xác định"}
      </p>
      <Button onClick={() => reset()}>Thử lại</Button>
    </div>
  );
}
