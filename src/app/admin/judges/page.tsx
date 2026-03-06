"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface JudgeRecord {
  id: string;
  fullName: string;
  slug: string;
  status: "UNVERIFIED" | "VERIFIED" | "REJECTED";
  court: {
    id: string;
    type: string;
    county: {
      id: string;
      name: string;
      state: { id: string; name: string };
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminJudgesPage() {
  const [judges, setJudges] = useState<JudgeRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchJudges = useCallback(
    async (page: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/judges?${params}`);
      const data = await res.json();
      setJudges(data.judges);
      setPagination(data.pagination);
      setLoading(false);
    },
    [search, statusFilter],
  );

  useEffect(() => {
    fetchJudges(1);
  }, [fetchJudges]);

  const handleVerify = async (id: string, currentStatus: string) => {
    const action = currentStatus === "VERIFIED" ? "unverify" : "verify";
    await fetch(`/api/admin/judges/${id}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchJudges(pagination.page);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete judge "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/judges/${id}`, { method: "DELETE" });
    fetchJudges(pagination.page);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1>Judge Records</h1>
        <Link
          href="/admin/judges/new/"
          className="px-4 py-2 bg-primary text-btn-primary-text rounded-md no-underline text-sm hover:bg-primary/90 transition-colors"
        >
          + Add Judge
        </Link>
      </div>

      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:gap-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search judges by name"
          className="px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
        >
          <option value="">All Status</option>
          <option value="VERIFIED">Verified</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : judges.length === 0 ? (
        <p className="text-muted-foreground">
          No judges found.{" "}
          <Link href="/admin/judges/new/" className="text-link hover:underline">
            Create the first judge record
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="py-3 px-2">Name</th>
                  <th className="py-3 px-2">Court</th>
                  <th className="py-3 px-2">Location</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {judges.map((judge) => (
                  <tr key={judge.id} className="border-b border-border">
                    <td className="py-3 px-2">
                      <strong>{judge.fullName}</strong>
                    </td>
                    <td className="py-3 px-2">{judge.court.type}</td>
                    <td className="py-3 px-2 text-sm text-muted-foreground">
                      {judge.court.county.name}, {judge.court.county.state.name}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={cn(
                          "inline-block px-2 py-1 rounded-full text-xs font-semibold",
                          judge.status === "VERIFIED"
                            ? "bg-badge-success-bg text-badge-success-text"
                            : judge.status === "REJECTED"
                              ? "bg-error-bg text-error-text"
                              : "bg-badge-warning-bg text-badge-warning-text",
                        )}
                      >
                        {judge.status === "VERIFIED"
                          ? "Verified"
                          : judge.status === "REJECTED"
                            ? "Rejected"
                            : "Unverified"}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-2 text-sm">
                        <button
                          onClick={() => handleVerify(judge.id, judge.status)}
                          className="px-2 py-1 border border-input rounded bg-background text-foreground cursor-pointer text-xs hover:bg-muted transition-colors"
                        >
                          {judge.status === "VERIFIED" ? "Unverify" : "Verify"}
                        </button>
                        <button
                          onClick={() => handleDelete(judge.id, judge.fullName)}
                          className="px-2 py-1 border border-error-text rounded bg-error-bg text-error-text cursor-pointer text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 mt-4 sm:flex-row">
            <span className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchJudges(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className={cn(
                  "px-4 py-2 border border-input rounded-md text-sm bg-background text-foreground",
                  pagination.page <= 1
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:bg-muted transition-colors",
                )}
              >
                Previous
              </button>
              <button
                onClick={() => fetchJudges(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className={cn(
                  "px-4 py-2 border border-input rounded-md text-sm bg-background text-foreground",
                  pagination.page >= pagination.totalPages
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:bg-muted transition-colors",
                )}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
