"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Don't hammer the API for answers that won't change on retry.
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {/* Every motion component honours the OS "reduce motion" setting. */}
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
