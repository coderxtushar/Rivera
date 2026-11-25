"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink } from "lucide-react";
import { PageFade } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Avatar, Badge, PageTitle, Pagination } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, date, fullName } from "@/lib/format";
import type { Paged, Role, User } from "@/lib/types";
import { ConfirmDialog, FilterBar, PAGE_SIZE, ROLE_LABEL, SearchField, useDebounced } from "../_components/shared";
import { Cell, DataTable, RangeNote, Row, SkeletonRows, TableEmpty, TableError } from "../_components/table";

type View = "all" | "applications";
type Patch = Partial<Pick<User, "role" | "status" | "instructorStatus">>;
type Confirm = { kind: "suspend" | "reactivate" | "admin"; user: User } | null;

const COLUMNS = [
  { label: "User" },
  { label: "Role", className: "w-44" },
  { label: "Status" },
  { label: "Joined" },
  { label: "Actions", srOnly: true, className: "text-right" },
];

export default function AdminUsersPage() {
  return (
    <PageFade>
      <PageTitle title="Users" sub="Search accounts, change roles, review instructor applications and suspend accounts that break the rules." />
      <Suspense fallback={<UsersTableFallback />}>
        <UsersView />
      </Suspense>
    </PageFade>
  );
}

function UsersTableFallback() {
  return (
    <DataTable caption="Users" columns={COLUMNS}>
      <SkeletonRows columns={COLUMNS.length} />
    </DataTable>
  );
}

function UsersView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view: View = params.get("view") === "applications" ? "applications" : "all";

  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<User["status"] | "">("");
  const [instructorStatus, setInstructorStatus] = useState<User["instructorStatus"] | "">("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const search = useDebounced(q.trim());

  const { user: me } = useAuth();
  const qc = useQueryClient();

  const filters =
    view === "applications" ? { q: search, instructorStatus: "pending" as const } : { q: search, role, status, instructorStatus };

  const list = useQuery({
    queryKey: ["admin", "users", { ...filters, page }],
    queryFn: () => api<Paged<User>>("/admin/users", { query: { ...filters, page, limit: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });

  const pendingCount = useQuery({
    queryKey: ["admin", "users", { instructorStatus: "pending", count: true }],
    queryFn: () => api<Paged<User>>("/admin/users", { query: { instructorStatus: "pending", limit: 1 } }).then((r) => r.meta.total),
  });

  const update = useMutation({
    mutationFn: ({ user, patch }: { user: User; patch: Patch; done: string }) =>
      api<{ data: { user: User } }>(`/admin/users/${user._id}`, { method: "PATCH", body: patch }),
    onSuccess: (_res, { done }) => {
      toast.success(done);
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const busyId = update.isPending ? update.variables?.user._id : undefined;

  const changeView = (v: View) => {
    setPage(1);
    setOpenId(null);
    router.replace(v === "applications" ? `${pathname}?view=applications` : pathname, { scroll: false });
  };

  const changeRole = (user: User, next: Role) => {
    if (next === user.role) return;
    if (next === "admin") return setConfirm({ kind: "admin", user });
    update.mutate({ user, patch: { role: next }, done: `${fullName(user) || user.email} is now ${next === "instructor" ? "an instructor" : "a student"}` });
  };

  const filtered = Boolean(search || (view === "all" && (role || status || instructorStatus)));
  const clearFilters = () => {
    setQ("");
    setRole("");
    setStatus("");
    setInstructorStatus("");
    setPage(1);
  };
  const setFilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const rows = list.data?.data ?? [];

  return (
    <>
      <div className="-mx-4 mb-6 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <Tabs<View>
          value={view}
          onChange={changeView}
          items={[
            { value: "all", label: "All users" },
            { value: "applications", label: "Instructor applications", count: pendingCount.data || undefined },
          ]}
        />
      </div>

      <FilterBar>
        <SearchField label="Search" value={q} onChange={setFilter(setQ)} placeholder="Name or email" />
        {view === "all" && (
          <>
            <Field label="Role">
              {(p) => (
                <Select {...p} value={role} onChange={(e) => setFilter(setRole)(e.target.value as Role | "")}>
                  <option value="">All roles</option>
                  <option value="student">Students</option>
                  <option value="instructor">Instructors</option>
                  <option value="admin">Admins</option>
                </Select>
              )}
            </Field>
            <Field label="Account status">
              {(p) => (
                <Select {...p} value={status} onChange={(e) => setFilter(setStatus)(e.target.value as User["status"] | "")}>
                  <option value="">Any status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </Select>
              )}
            </Field>
            <Field label="Instructor application">
              {(p) => (
                <Select {...p} value={instructorStatus} onChange={(e) => setFilter(setInstructorStatus)(e.target.value as User["instructorStatus"] | "")}>
                  <option value="">Any</option>
                  <option value="pending">Waiting for review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="none">Never applied</option>
                </Select>
              )}
            </Field>
          </>
        )}
      </FilterBar>

      <div className={cn("transition-opacity", list.isPlaceholderData && "opacity-60")}>
        <DataTable caption={view === "applications" ? "Instructor applications" : "Users"} columns={COLUMNS}>
          {list.isPending ? (
            <SkeletonRows columns={COLUMNS.length} />
          ) : list.isError ? (
            <TableError error={list.error} onRetry={() => list.refetch()} />
          ) : rows.length === 0 ? (
            filtered ? (
              <TableEmpty
                title="No users match"
                body="Try a different name or email, or clear the filters."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : view === "applications" ? (
              <TableEmpty title="No applications waiting" body="When someone applies to teach on Rivera, their application shows up here for review." />
            ) : (
              <TableEmpty title="No users yet" body="People who sign up show up here." />
            )
          ) : (
            rows.map((u) => {
              const self = u._id === me?._id;
              const name = fullName(u) || u.email;
              const busy = busyId === u._id;
              const hasApplication = u.instructorStatus === "pending" && Boolean(u.headline || u.bio || u.website);
              const open = openId === u._id;
              return (
                <Row
                  key={u._id}
                  detailOpen={open}
                  detail={hasApplication ? <ApplicationDetail user={u} /> : undefined}
                >
                  <Cell lead>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar user={u} size={36} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                          <span className="break-words">{name}</span>
                          {self && <Badge tone="ink">You</Badge>}
                        </p>
                        <p className="break-all text-ink-3">{u.email}</p>
                        {hasApplication && (
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : u._id)}
                            aria-expanded={open}
                            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-channel hover:underline"
                          >
                            {open ? "Hide application" : "Read application"}
                            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>
                  </Cell>
                  <Cell label="Role">
                    <Select
                      aria-label={`Role for ${name}`}
                      value={u.role}
                      disabled={self || busy}
                      title={self ? "You can't change your own role" : undefined}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      className="h-9 w-36 text-sm"
                    >
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                  </Cell>
                  <Cell label="Status">
                    <span className="flex flex-wrap justify-end gap-1.5 md:justify-start">
                      {u.status === "suspended" ? <Badge tone="buoy">Suspended</Badge> : <Badge tone="reef">Active</Badge>}
                      {u.instructorStatus === "pending" && <Badge tone="current">Applied to teach</Badge>}
                      {u.instructorStatus === "rejected" && <Badge>Application rejected</Badge>}
                    </span>
                  </Cell>
                  <Cell label="Joined" className="tabular-nums whitespace-nowrap">
                    {date(u.createdAt)}
                  </Cell>
                  <Cell actions className="md:text-right">
                    {self ? (
                      <span className="text-sm text-ink-3">You can&apos;t change your own account</span>
                    ) : (
                      <span className="flex flex-wrap gap-2 md:justify-end">
                        {u.instructorStatus === "pending" && (
                          <>
                            <Button
                              size="sm"
                              loading={busy && update.variables?.patch.instructorStatus === "approved"}
                              disabled={busy}
                              onClick={() => update.mutate({ user: u, patch: { instructorStatus: "approved" }, done: "Instructor approved" })}
                            >
                              Approve instructor
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={busy && update.variables?.patch.instructorStatus === "rejected"}
                              disabled={busy}
                              onClick={() => update.mutate({ user: u, patch: { instructorStatus: "rejected" }, done: "Application rejected" })}
                            >
                              Reject application
                            </Button>
                          </>
                        )}
                        {u.status === "active" ? (
                          <Button size="sm" variant="ghost" className="text-[#b23417]!" disabled={busy} onClick={() => setConfirm({ kind: "suspend", user: u })}>
                            Suspend user
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ kind: "reactivate", user: u })}>
                            Reactivate user
                          </Button>
                        )}
                      </span>
                    )}
                  </Cell>
                </Row>
              );
            })
          )}
        </DataTable>
      </div>

      <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <RangeNote meta={list.data?.meta} />
        <Pagination meta={list.data?.meta} onPage={setPage} />
      </div>

      <UserConfirm
        confirm={confirm}
        loading={update.isPending}
        onClose={() => !update.isPending && setConfirm(null)}
        onConfirm={(c) => {
          const name = fullName(c.user) || c.user.email;
          if (c.kind === "suspend") update.mutate({ user: c.user, patch: { status: "suspended" }, done: "User suspended" });
          if (c.kind === "reactivate") update.mutate({ user: c.user, patch: { status: "active" }, done: "User reactivated" });
          if (c.kind === "admin") update.mutate({ user: c.user, patch: { role: "admin" }, done: `${name} is now an admin` });
        }}
      />
    </>
  );
}

function ApplicationDetail({ user }: { user: User }) {
  return (
    <div className="max-w-2xl space-y-2 text-sm">
      {user.headline && <p className="font-semibold text-ink">{user.headline}</p>}
      {user.bio ? <p className="whitespace-pre-line text-ink-2">{user.bio}</p> : <p className="text-ink-3">No bio provided.</p>}
      {user.website && (
        <a href={user.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-channel hover:underline">
          {user.website.replace(/^https?:\/\//, "")}
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}

function UserConfirm({ confirm, loading, onClose, onConfirm }: { confirm: Confirm; loading: boolean; onClose: () => void; onConfirm: (c: NonNullable<Confirm>) => void }) {
  // Keep the last target while the dialog animates out.
  const [last, setLast] = useState<NonNullable<Confirm> | null>(confirm);
  if (confirm && confirm !== last) setLast(confirm);
  const c = confirm ?? last;
  if (!c) return null;
  const name = fullName(c.user) || c.user.email;

  const copy = {
    suspend: {
      title: `Suspend ${name}?`,
      body: "They are signed out on every device right away and can't sign in until you reactivate them. Their courses, purchases and progress are kept.",
      label: "Suspend user",
    },
    reactivate: {
      title: `Reactivate ${name}?`,
      body: "They can sign in again and pick up where they left off.",
      label: "Reactivate user",
    },
    admin: {
      title: `Make ${name} an admin?`,
      body: "Admins can change any account, refund orders and edit every course. Only give this to people you trust with the whole platform.",
      label: "Make admin",
    },
  }[c.kind];

  return (
    <ConfirmDialog open={Boolean(confirm)} onClose={onClose} title={copy.title} confirmLabel={copy.label} loading={loading} danger={c.kind !== "reactivate"} onConfirm={() => onConfirm(c)}>
      <p>{copy.body}</p>
    </ConfirmDialog>
  );
}
