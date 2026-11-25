import type { Metadata } from "next";
import { BUSINESS, LegalPage, SupportLine } from "../_components/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" intro={`This policy explains what ${BUSINESS.name} collects, why, and what you can do about it.`}>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, email address and a securely hashed password.</li>
        <li>Profile details you choose to add, such as a photo, headline or website.</li>
        <li>Learning activity: courses you enroll in, lessons you complete, reviews you write.</li>
        <li>Purchase records: course, amount, date and the payment reference from Razorpay. Card and bank details go to Razorpay directly and never reach us.</li>
        <li>Technical data: IP address and browser information, used for security and rate limiting.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To run your account, give you access to courses you bought, track your progress, issue certificates, send account emails (verification, password reset, receipts), prevent fraud, and pay instructors their earnings.</p>
      <h2>Who sees it</h2>
      <p>Instructors see the names and progress of students in their own courses, but not their email addresses. Certificates show your name publicly to anyone with the link. We share payment data with Razorpay to process payments, and use hosting providers to run the service. We don&apos;t sell your data.</p>
      <h2>Cookies</h2>
      <p>We use only the cookies needed to keep you signed in. There are no advertising cookies.</p>
      <h2>Your choices</h2>
      <p>You can edit your profile in Settings and delete your account at any time from Settings. Purchase records are kept as required for accounting and tax purposes.</p>
      <h2>Contact</h2>
      <p>For any privacy question, <SupportLine />.</p>
    </LegalPage>
  );
}
