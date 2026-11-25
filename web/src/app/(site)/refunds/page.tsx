import type { Metadata } from "next";
import { BUSINESS, LegalPage, SupportLine } from "../_components/legal";

export const metadata: Metadata = { title: "Refunds and cancellations" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refunds and cancellations" intro="Every course has free preview lessons so you can try before you buy. If a course still isn't right for you, you can ask for a refund.">
      <h2>Asking for a refund</h2>
      <p>Request a refund within 7 days of purchase. To request one, <SupportLine /> with the email address on your account and the course name. You can find your purchases under My learning, then Purchases.</p>
      <h2>What happens next</h2>
      <p>Approved refunds are sent back to your original payment method through Razorpay. Banks usually take 5 to 7 working days to show the money in your account. When a refund is processed, your access to the course, your progress in it, your review and any certificate for it are removed.</p>
      <h2>Payments that didn&apos;t go through</h2>
      <p>If money left your account but the course didn&apos;t unlock, or you were charged twice for the same course, {BUSINESS.name} refunds the extra payment automatically. If you don&apos;t see it within 7 working days, contact us.</p>
      <h2>Cancellations</h2>
      <p>Courses are one-time purchases, not subscriptions, so there is nothing to cancel and no recurring charge.</p>
      <h2>Delivery</h2>
      <p>Courses are digital. Access is delivered instantly to your account once payment is confirmed, and a confirmation email is sent. Nothing is shipped.</p>
    </LegalPage>
  );
}
