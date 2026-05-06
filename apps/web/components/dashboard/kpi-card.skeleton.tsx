export function KpiCardSkeleton() {
  return (
    <div className="min-h-[180px] animate-pulse rounded-[12px] bg-white p-6 shadow-[0_1px_3px_rgba(26,43,46,0.05)]">
      <div className="h-3 w-24 rounded-full bg-[#dce8e4]" />
      <div className="mt-6 h-10 w-28 rounded-full bg-[#dce8e4]" />
      <div className="mt-5 h-4 w-36 rounded-full bg-[#edf4f2]" />
      <div className="mt-6 h-6 w-20 rounded-full bg-[#edf4f2]" />
    </div>
  );
}
