import { ScannerWorkspace } from "@/components/scanner/ScannerWorkspace";

export default function ScannerPage() {
  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl md:text-2xl font-bold">Scanner</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Build custom filter presets — double-click a tab name to rename it
        </p>
      </div>
      <ScannerWorkspace />
    </div>
  );
}
