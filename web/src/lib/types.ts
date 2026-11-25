/** Shapes returned by the Rivera API (see ../../docs/API.md). Money is in minor units. */

export type Role = "student" | "instructor" | "admin";
export type Level = "beginner" | "intermediate" | "advanced" | "all";
export type CourseStatus = "draft" | "published" | "archived";
export type OrderStatus = "created" | "paid" | "failed" | "refunded" | "refund_pending";

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: "active" | "suspended";
  isEmailVerified: boolean;
  avatarUrl: string;
  headline: string;
  bio: string;
  website: string;
  instructorStatus: "none" | "pending" | "approved" | "rejected";
  createdAt: string;
  lastLoginAt?: string;
}

export type PublicUser = Pick<User, "_id" | "firstName" | "lastName" | "avatarUrl" | "headline" | "bio" | "website" | "role">;

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description: string;
  courseCount?: number;
}

export interface CourseStats {
  enrollmentCount: number;
  ratingAvg: number;
  ratingCount: number;
  lessonCount: number;
  totalDurationSec: number;
}

export interface Section {
  _id: string;
  title: string;
  order: number;
}

export interface Course {
  _id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  instructor: PublicUser | string;
  category?: Pick<Category, "_id" | "name" | "slug"> | string | null;
  tags: string[];
  level: Level;
  language: string;
  price: number;
  currency: string;
  isFree?: boolean;
  thumbnailUrl: string;
  promoVideoUrl: string;
  requirements: string[];
  outcomes: string[];
  sections: Section[];
  status: CourseStatus;
  isFeatured: boolean;
  publishedAt?: string;
  stats: CourseStats;
  createdAt: string;
  updatedAt: string;
}

export interface Resource {
  title: string;
  url: string;
}

export interface Lesson {
  _id: string;
  course: string;
  section: string;
  title: string;
  type: "video" | "article";
  videoUrl?: string;
  content?: string;
  durationSec: number;
  isPreview: boolean;
  order: number;
  resources?: Resource[];
}

export interface CurriculumSection extends Section {
  lessons: Lesson[];
}

export interface Progress {
  completedLessons: string[];
  lastLesson?: string;
  lastAccessedAt?: string;
  percent: number;
  completedAt?: string;
}

export interface Viewer {
  isEnrolled: boolean;
  canManage: boolean;
  isWishlisted: boolean;
  progress: Progress | null;
}

export interface Enrollment {
  _id: string;
  user: string | PublicUser;
  course: Course;
  source: "free" | "purchase" | "admin_grant";
  pricePaid: number;
  currency: string;
  progress: Progress;
  createdAt: string;
}

export interface Order {
  _id: string;
  user: string | (PublicUser & { email?: string });
  course: string | Pick<Course, "_id" | "title" | "slug" | "thumbnailUrl">;
  courseTitle?: string;
  originalAmount: number;
  discount: number;
  amount: number;
  currency: string;
  platformFee?: number;
  instructorEarning?: number;
  couponCode?: string;
  provider: "mock" | "razorpay" | "stripe" | "none";
  status: OrderStatus;
  paidAt?: string;
  refundedAt?: string;
  failureReason?: string;
  createdAt: string;
}

export interface Coupon {
  _id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  course?: Pick<Course, "_id" | "title" | "slug"> | string | null;
  maxRedemptions?: number | null;
  redemptionCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Review {
  _id: string;
  user: Pick<User, "_id" | "firstName" | "lastName" | "avatarUrl"> | string;
  course: string;
  rating: number;
  comment: string;
  instructorReply?: { text: string; repliedAt: string };
  createdAt: string;
}

export interface Certificate {
  _id?: string;
  code: string;
  studentName: string;
  courseTitle: string;
  instructorName: string;
  issuedAt: string;
  course?: Pick<Course, "_id" | "slug" | "title" | "thumbnailUrl"> | string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export type PaymentPayload =
  | { provider: "mock"; orderId: string; hint?: string }
  | {
      provider: "razorpay";
      orderId: string;
      keyId: string;
      razorpayOrderId: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      prefill: { name: string; email: string };
    }
  | { provider: "stripe"; orderId: string; checkoutUrl: string };

export interface CheckoutResult {
  order: Order | null;
  enrollment?: Enrollment | null;
  requiresPayment: boolean;
  payment?: PaymentPayload;
}

export interface Quote {
  originalAmount: number;
  discount: number;
  amount: number;
  currency: string;
  coupon: { code: string; type: "percent" | "fixed"; value: number } | null;
}
