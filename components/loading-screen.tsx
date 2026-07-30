import { Loader2 } from "lucide-react";

export function LoadingScreen({ label = "Завантаження…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
