import Link from "next/link";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />
      <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col items-center justify-center px-6 py-16 text-center lg:px-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1f2937]">
          This YummyDoors page does not exist.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#6b7280]">
          The route may have moved, or the page may not be available in the current workspace yet.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/">
            <Button>Go home</Button>
          </Link>
          <Link href="/restaurants">
            <Button variant="secondary">Browse restaurants</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
