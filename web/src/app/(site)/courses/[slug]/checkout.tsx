"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import type { CheckoutResult, Course, Order, PaymentPayload } from "@/lib/types";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (evt: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Razorpay checkout couldn't load. Check your connection or ad blocker."));
    document.body.appendChild(s);
  });
}

/**
 * Runs a checkout for whichever provider the API is configured with:
 * free/100%-coupon (instant), mock (test dialog), Razorpay (modal), Stripe (redirect).
 */
export function useCheckout(course: Course) {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState<{ orderId: string; amount: number; currency: string } | null>(null);

  const finish = useCallback(
    async (order: Order | null) => {
      if (order && order.status !== "paid") {
        toast.error(order.failureReason || "The payment didn't go through. You haven't been charged.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["course", course.slug] });
      toast.success(course.price === 0 ? "You're enrolled" : "Payment received. You're enrolled");
      router.push(`/learn/${course.slug}`);
    },
    [qc, course.slug, course.price, router],
  );

  const verify = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await api<{ data: { order: Order } }>("/payments/verify", { method: "POST", body });
      await finish(res.data.order);
    },
    [finish],
  );

  const start = useCallback(
    async (couponCode?: string) => {
      setBusy(true);
      try {
        const res = await api<{ data: CheckoutResult }>("/payments/checkout", {
          method: "POST",
          body: { courseId: course._id, ...(couponCode ? { couponCode } : {}) },
        });
        const { requiresPayment, payment, order } = res.data;
        if (!requiresPayment) return await finish(order);
        const p = payment as PaymentPayload;
        if (p.provider === "mock") {
          setMock({ orderId: p.orderId, amount: order?.amount ?? 0, currency: order?.currency ?? course.currency });
        } else if (p.provider === "stripe") {
          window.location.assign(p.checkoutUrl);
        } else if (p.provider === "razorpay") {
          await loadRazorpay();
          const rz = new window.Razorpay!({
            key: p.keyId,
            order_id: p.razorpayOrderId,
            amount: p.amount,
            currency: p.currency,
            name: p.name,
            description: p.description,
            prefill: p.prefill,
            theme: { color: "#2340f5" },
            handler: (response: Record<string, string>) => {
              verify({ orderId: p.orderId, ...response }).catch((err) => toast.error(errorMessage(err)));
            },
            modal: { ondismiss: () => toast.info("Payment cancelled. You haven't been charged.") },
          });
          rz.open();
        }
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [course._id, course.currency, finish, verify],
  );

  const mockDialog = (
    <Dialog open={Boolean(mock)} onClose={() => setMock(null)} title="Test payment" description="This server uses the development payment provider. No real money moves.">
      {mock && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between rounded-card bg-mist p-4">
            <span className="text-ink-2">{course.title}</span>
            <span className="text-lg font-bold">{money(mock.amount, mock.currency)}</span>
          </div>
          <Button
            size="lg"
            loading={busy}
            icon={<CreditCard className="size-4" />}
            onClick={async () => {
              setBusy(true);
              try {
                await verify({ orderId: mock.orderId });
                setMock(null);
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Pay {money(mock.amount, mock.currency)}
          </Button>
        </div>
      )}
    </Dialog>
  );

  return { start, busy, mockDialog };
}
