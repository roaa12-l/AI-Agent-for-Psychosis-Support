import Link from "next/link";
import { AnchorBrand } from "@/components/anchor-brand";
import { PatientNav } from "./_components/patient-nav";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex justify-center bg-bg">
      {/* Mobile-shaped column, centered on desktop, full-bleed on phones */}
      <div className="w-full max-w-[480px] min-h-screen flex flex-col bg-card border-x border-line">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-card/90 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-2">
          <Link href="/patient/chat" className="flex items-center gap-2 text-ink">
            <AnchorBrand size="sm" />
          </Link>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-sage font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-sage" />
            connected
          </span>
        </header>

        <main className="flex-1 flex flex-col min-h-0">{children}</main>

        <PatientNav />
      </div>
    </div>
  );
}
