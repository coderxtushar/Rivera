"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AuthHeading } from "../form-kit";

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const { user, refresh } = useAuth();
  const [state, setState] = useState<"working" | "done" | "failed">(token ? "working" : "failed");
  const [message, setMessage] = useState(token ? "" : "This link is missing its token.");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // the token is single-use; never send it twice
    api("/auth/verify-email", { method: "POST", body: { token }, noRefresh: true })
      .then(async () => {
        setState("done");
        await refresh();
      })
      .catch((err) => {
        setState("failed");
        setMessage(errorMessage(err));
      });
  }, [token, refresh]);

  if (state === "working") {
    return (
      <div className="flex items-center gap-3 text-ink-2">
        <Spinner className="size-5" /> Verifying your email
      </div>
    );
  }
  if (state === "done") {
    return (
      <>
        <CheckCircle2 className="size-10 text-reef" />
        <AuthHeading title="Email verified" sub="Thanks. Your account is all set." />
        <ButtonLink href={user ? "/dashboard" : "/signin"} size="lg">
          {user ? "Go to my learning" : "Sign in"}
        </ButtonLink>
      </>
    );
  }
  return (
    <>
      <XCircle className="size-10 text-buoy" />
      <AuthHeading title="This link didn't work" sub={`${message} Links expire after 24 hours and work once. You can send a new one from Settings.`} />
      <ButtonLink href={user ? "/settings" : "/signin"}>{user ? "Open settings" : "Sign in"}</ButtonLink>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
