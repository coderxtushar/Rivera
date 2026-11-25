import { Suspense } from "react";
import { Player } from "./_components/player";
import { PlayerSkeleton } from "./_components/night";

export default function LearnPage() {
  return (
    <Suspense fallback={<PlayerSkeleton />}>
      <Player />
    </Suspense>
  );
}
