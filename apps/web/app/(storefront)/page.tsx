import { Suspense } from "react";
import { StorefrontSectionsManager } from "./_components/landing/storefront-sections-manager";

export default function LandingPage() {
  return (
    <main className="bg-white min-h-screen filter-card-scroll">
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <StorefrontSectionsManager />
      </Suspense>
    </main>
  );
}
