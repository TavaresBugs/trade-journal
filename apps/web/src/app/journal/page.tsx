"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Loading from "@/app/loading";

export default function JournalPage() {
  return (
    <Suspense fallback={<Loading />}>
      <JournalRedirect />
    </Suspense>
  );
}

function JournalRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "list");
    router.replace(`/calendar?${params.toString()}`);
  }, [router, searchParams]);

  return <Loading />;
}
