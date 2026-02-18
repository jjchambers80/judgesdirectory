"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>Judge Records</h1>
        <Link
          href="/admin/judges/new/"
          style={{
            padding: "0.5rem 1rem",
            background: "var(--color-btn-primary)",
            color: "var(--color-btn-primary-text)",
            borderRadius: "0.375rem",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          + Add Judge
        </Link>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid var(--color-input-border)",
            borderRadius: "0.375rem",
            flex: 1,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid var(--color-input-border)",
            borderRadius: "0.375rem",
          }}
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
        <p style={{ color: "var(--color-text-muted)" }}>
          No judges found.{" "}
          <Link
            href="/admin/judges/new/"
            style={{ color: "var(--color-link)" }}
          >
            Create the first judge record
          </Link>
          .
        </p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.75rem 0.5rem" }}>Name</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Court</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Location</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
                <th style={{ padding: "0.75rem 0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((judge) => (
                <tr
                  key={judge.id}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <strong>{judge.fullName}</strong>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    {judge.court.type}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 0.5rem",
                      fontSize: "0.875rem",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {judge.court.county.name}, {judge.court.county.state.name}
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background:
                          judge.status === "VERIFIED"
                            ? "var(--color-badge-success-bg)"
                            : judge.status === "REJECTED"
                              ? "var(--color-error-bg)"
                              : "var(--color-badge-warning-bg)",
                        color:
                          judge.status === "VERIFIED"
                            ? "var(--color-badge-success-text)"
                            : judge.status === "REJECTED"
                              ? "var(--color-error-text)"
                              : "var(--color-badge-warning-text)",
                      }}
                    >
                      {judge.status === "VERIFIED"
                        ? "Verified"
                        : judge.status === "REJECTED"
                          ? "Rejected"
                          : "Unverified"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                    >
                      <button
                        onClick={() => handleVerify(judge.id, judge.status)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          border: "1px solid var(--color-input-border)",
                          borderRadius: "0.25rem",
                          background: "var(--color-bg-primary)",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                        }}
                      >
                        {judge.status === "VERIFIED" ? "Unverify" : "Verify"}
                      </button>
                      <button
                        onClick={() => handleDelete(judge.id, judge.fullName)}
                        style={{
                          padding: "0.25rem 0.5rem",
                          border: "1px solid var(--color-input-border-error)",
                          borderRadius: "0.25rem",
                          background: "var(--color-error-bg)",
                          color: "var(--color-error-text)",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1rem",
            }}
          >
            <span
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
            >
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => fetchJudges(pagination.page - 1)}
                disabled={pagination.page <= 1}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid var(--color-input-border)",
                  borderRadius: "0.375rem",
                  cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                  opacity: pagination.page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <button
                onClick={() => fetchJudges(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid var(--color-input-border)",
                  borderRadius: "0.375rem",
                  cursor:
                    pagination.page >= pagination.totalPages
                      ? "not-allowed"
                      : "pointer",
                  opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
                }}
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
