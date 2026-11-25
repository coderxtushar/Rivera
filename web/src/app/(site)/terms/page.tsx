import type { Metadata } from "next";
import { BUSINESS, LegalPage, SupportLine } from "../_components/legal";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" intro={`These terms apply when you use ${BUSINESS.name} to learn or to teach. By creating an account you agree to them.`}>
      <h2>Your account</h2>
      <p>You need an account to enroll in or publish courses. Keep your password private; you are responsible for activity on your account. You must be at least 18, or have a parent or guardian&apos;s permission.</p>
      <h2>Buying courses</h2>
      <p>Prices are shown in Indian rupees and include applicable taxes. When a payment succeeds you get access to the course for as long as it remains available on {BUSINESS.name}, including if the instructor later archives it. Payments are processed by Razorpay; we never see or store your card or bank details.</p>
      <p>Access is for your personal learning. Don&apos;t share your account, download or redistribute course videos, or resell course content.</p>
      <h2>Teaching on {BUSINESS.name}</h2>
      <p>Instructors keep ownership of their course content and grant {BUSINESS.name} a licence to host, show and sell it. You confirm you have the rights to everything you upload. {BUSINESS.name} keeps a platform fee from each sale; the rest is your earnings, shown in the instructor studio.</p>
      <p>We may remove courses that are misleading, infringe someone else&apos;s rights, or break the law.</p>
      <h2>Certificates</h2>
      <p>Certificates confirm that an account completed every lesson of a course. They are not academic qualifications. A certificate is withdrawn if its purchase is refunded.</p>
      <h2>Suspension</h2>
      <p>We may suspend accounts that abuse the platform, attempt fraud, or break these terms.</p>
      <h2>Liability</h2>
      <p>Courses are provided as they are. To the extent the law allows, {BUSINESS.name}&apos;s liability for any claim is limited to the amount you paid for the course concerned.</p>
      <h2>Changes and contact</h2>
      <p>We&apos;ll post changes to these terms on this page. Questions? <SupportLine />.</p>
    </LegalPage>
  );
}
