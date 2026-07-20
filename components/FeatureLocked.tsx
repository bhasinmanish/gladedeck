import { Lock } from "lucide-react";

interface Props {
  name:  string;
  price: number;
}

// Shown in place of a gated feature's content when the current user
// hasn't unlocked it. Payment is not wired up yet, so the CTA is inert.
export function FeatureLocked({ name, price }: Props) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5 border border-border rounded-xl p-8 bg-card shadow-sm">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-7 w-7 text-primary" />
        </div>

        <div>
          <h2 className="text-lg font-bold">{name} is a premium feature</h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Unlock {name} to access it. Purchasing isn&apos;t available just
            yet — it&apos;s coming soon.
          </p>
        </div>

        <div className="text-4xl font-bold font-mono">
          ${price.toFixed(2)}
        </div>

        <button
          disabled
          className="w-full rounded-md bg-primary/40 text-primary-foreground text-sm font-medium py-2.5 cursor-not-allowed"
        >
          Purchase — coming soon
        </button>
      </div>
    </div>
  );
}
