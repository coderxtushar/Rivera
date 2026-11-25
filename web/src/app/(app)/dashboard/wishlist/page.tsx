"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartOff } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { CourseCard, CourseCardSkeleton } from "@/components/course/course-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageTitle } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import type { Course } from "@/lib/types";
import { QueryError } from "../_components/query-error";

const KEY = ["dashboard", "wishlist"];
type WishlistData = { data: Course[] };

export default function WishlistPage() {
  const qc = useQueryClient();
  const wishlist = useQuery({ queryKey: KEY, queryFn: () => api<WishlistData>("/users/me/wishlist") });

  const remove = useMutation({
    mutationFn: (course: Course) => api(`/users/me/wishlist/${course._id}`, { method: "DELETE" }),
    onMutate: async (course) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<WishlistData>(KEY);
      qc.setQueryData<WishlistData>(KEY, (old) => old && { data: old.data.filter((c) => c._id !== course._id) });
      return { previous };
    },
    onSuccess: (_d, course) => toast.success(`Removed ${course.title} from your wishlist`),
    onError: (err, _course, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error(errorMessage(err));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const courses = wishlist.data?.data ?? [];

  return (
    <PageFade>
      <PageTitle title="Wishlist" sub="Courses you've saved for later. Prices can change, so check before you buy." />

      {wishlist.isPending ? (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3" aria-busy aria-label="Loading your wishlist">
          {[0, 1, 2].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      ) : wishlist.isError ? (
        <QueryError title="We couldn't load your wishlist" error={wishlist.error} onRetry={() => wishlist.refetch()} retrying={wishlist.isFetching} />
      ) : courses.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Tap the heart on any course to keep it here while you decide."
          action={<ButtonLink href="/courses">Browse courses</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {courses.map((course) => (
              <motion.li
                key={course._id}
                layout
                exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
                className="relative"
              >
                <CourseCard course={course} className="h-full" />
                <button
                  type="button"
                  onClick={() => remove.mutate(course)}
                  aria-label={`Remove ${course.title} from wishlist`}
                  title="Remove from wishlist"
                  className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/95 text-ink shadow-lift transition-colors hover:bg-buoy hover:text-white"
                >
                  <HeartOff className="size-4.5" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </PageFade>
  );
}
