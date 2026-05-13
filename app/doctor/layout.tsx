import Link from "next/link";
import { AnchorBrand } from "@/components/anchor-brand";
import { minJun } from "@/lib/min-jun";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex bg-bg min-h-screen">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 border-r border-line bg-card flex flex-col">
        <div className="px-5 py-4 border-b border-line text-plum">
          <Link href="/doctor" className="flex items-center gap-2">
            <AnchorBrand size="md" />
            <span className="text-[10.5px] tracking-[0.16em] uppercase text-muted font-bold ml-1">
              Clinician
            </span>
          </Link>
        </div>

        <div className="px-3 py-4 flex-1 overflow-y-auto">
          <div className="text-[10.5px] tracking-[0.14em] uppercase text-muted font-bold px-3 mb-2">
            Patients
          </div>
          <Link
            href={`/doctor/patient/${minJun.id}/report`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[12px] font-bold">
              MJ
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink truncate">
                {minJun.name}
              </div>
              <div className="text-[11px] text-muted">{minJun.diagnosis}</div>
            </div>
          </Link>
        </div>

        <div className="px-5 py-3 border-t border-line text-[11px] text-muted">
          Signed in as <strong className="text-ink">Dr. Lee Hye-jin</strong>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
