import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/components/modules/skeletons";

export default function AppLoading() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 shrink-0 flex-col border-r bg-sidebar-background lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-white/5 px-3">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex-1 space-y-2 p-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-6">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <main className="flex-1 px-6 py-6">
          <DashboardSkeleton />
        </main>
      </div>
    </div>
  );
}