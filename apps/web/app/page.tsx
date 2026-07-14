"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/login");
  }, [router]);
  return <span>Đang chuyển...</span>;
}
