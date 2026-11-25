"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import type { Order } from "@/lib/types";

/** Stripe sends buyers here; the webhook confirms the payment, so poll until it lands. */
function Success() {
  const orderId = useSearchParams().get("orderId");
  const { data: order, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api<{ data: { order: Order } }>(`/payments/orders/${orderId}`).then((r) => r.data.order),
    enabled: Boolean(orderId),
    refetchInterval: (q) => (q.state.data?.status === "created" && q.state.dataUpdateCount < 20 ? 2000 : false),
  });

  if (!orderId) {
    return <EmptyState title="No order to show" body="This page confirms purchases. Open it from the checkout instead." action={<ButtonLink href="/dashboard/purchases">See my purchases</ButtonLink>} />;
  }
  if (error) return <EmptyState title="We couldn't load your order" body={errorMessage(error)} action={<ButtonLink href="/dashboard/purchases">See my purchases</ButtonLink>} />;
  if (!order || order.status === "created") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center text-ink-2">
        <Spinner className="size-7 text-channel" />
        <p>Confirming your payment. This usually takes a few seconds.</p>
      </div>
    );
  }

  const course = typeof order.course === "object" ? order.course : null;
  if (order.status !== "paid") {
    return (
      <EmptyState
        title={order.status === "refunded" ? "This payment was refunded" : "The payment didn't complete"}
        body={order.failureReason || "You haven't been charged. Try again from the course page."}
        action={course && <ButtonLink href={`/courses/${course.slug}`}>Back to the course</ButtonLink>}
      />
    );
  }

  return (
    <div className="relative flex flex-col items-center py-10 text-center">
      <svg aria-hidden viewBox="0 0 200 200" className="absolute -top-6 size-56">
        {[0, 1, 2, 3].map((i) => (
          <motion.circle
            key={i}
            cx="100"
            cy="100"
            r={30 + i * 22}
            fill="none"
            className="stroke-reef"
            strokeWidth="1.5"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 2.2, delay: i * 0.25, repeat: 2, ease: "easeOut" }}
            style={{ transformOrigin: "100px 100px" }}
          />
        ))}
      </svg>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="relative grid size-16 place-items-center rounded-full bg-reef text-white">
        <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.5 }} />
        </svg>
      </motion.div>
      <h1 className="display relative mt-24 text-4xl" style={{ ["--wdth" as string]: 100 }}>
        You&apos;re enrolled
      </h1>
      <p className="mt-3 max-w-md text-ink-2">
        {money(order.amount, order.currency)} paid for <strong className="text-ink">{course?.title ?? order.courseTitle}</strong>. A receipt is on its way to your inbox.
      </p>
      {course && (
        <ButtonLink href={`/learn/${course.slug}`} size="lg" className="mt-8">
          Start learning
        </ButtonLink>
      )}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <Suspense>
        <Success />
      </Suspense>
    </div>
  );
}
