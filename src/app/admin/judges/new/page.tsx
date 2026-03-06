"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface StateOption {
  id: string;
  name: string;
  abbreviation: string;
}

interface CountyOption {
  id: string;
  name: string;
}

interface CourtOption {
  id: string;
  type: string;
}

export default function AdminJudgeNewPage() {
  const router = useRouter();

  // Dropdown data
  const [states, setStates] = useState<StateOption[]>([]);
  const [counties, setCounties] = useState<CountyOption[]>([]);
  const [courts, setCourts] = useState<CourtOption[]>([]);

  // Selected cascading values
  const [selectedStateId, setSelectedStateId] = useState("");
  const [selectedCountyId, setSelectedCountyId] = useState("");
  const [selectedCourtId, setSelectedCourtId] = useState("");

  // New court creation
  const [showNewCourt, setShowNewCourt] = useState(false);
  const [newCourtType, setNewCourtType] = useState("");

  // Judge fields
  const [fullName, setFullName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [selectionMethod, setSelectionMethod] = useState("");
  const [appointingAuthority, setAppointingAuthority] = useState("");
  const [education, setEducation] = useState("");
  const [priorExperience, setPriorExperience] = useState("");
  const [politicalAffiliation, setPoliticalAffiliation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  // UI state
  const [errors, setErrors] = useState<
    Array<{ field: string; message: string }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Load states on mount
  useEffect(() => {
    fetch("/api/admin/states")
      .then((r) => r.json())
      .then((d) => setStates(d.states));
  }, []);

  // Load counties when state changes
  useEffect(() => {
    if (!selectedStateId) {
      setCounties([]);
      setSelectedCountyId("");
      return;
    }
    fetch(`/api/admin/states/${selectedStateId}/counties`)
      .then((r) => r.json())
      .then((d) => setCounties(d.counties));
    setSelectedCountyId("");
    setCourts([]);
    setSelectedCourtId("");
  }, [selectedStateId]);

  // Load courts when county changes
  useEffect(() => {
    if (!selectedCountyId) {
      setCourts([]);
      setSelectedCourtId("");
      return;
    }
    fetch(`/api/admin/counties/${selectedCountyId}/courts`)
      .then((r) => r.json())
      .then((d) => setCourts(d.courts));
    setSelectedCourtId("");
  }, [selectedCountyId]);

  const handleCreateCourt = async () => {
    if (!newCourtType.trim() || !selectedCountyId) return;
    const res = await fetch(`/api/admin/counties/${selectedCountyId}/courts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newCourtType.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setCourts((prev) => [...prev, data.court]);
      setSelectedCourtId(data.court.id);
      setNewCourtType("");
      setShowNewCourt(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);
    setSuccess(false);

    const res = await fetch("/api/admin/judges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courtId: selectedCourtId,
        fullName,
        termStart: termStart || undefined,
        termEnd: termEnd || undefined,
        selectionMethod: selectionMethod || undefined,
        appointingAuthority: appointingAuthority || undefined,
        education: education || undefined,
        priorExperience: priorExperience || undefined,
        politicalAffiliation: politicalAffiliation || undefined,
        sourceUrl,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setErrors(data.details || [{ field: "", message: data.error }]);
      return;
    }

    setSuccess(true);
    // Reset form after a brief delay
    setTimeout(() => {
      router.push("/admin/judges/");
    }, 1500);
  };

  const fieldError = (field: string) =>
    errors.find((e) => e.field === field)?.message;

  const inputClasses = (field: string) =>
    cn(
      "block w-full px-3 py-2 border rounded-md mt-1 bg-background text-foreground placeholder:text-muted-foreground",
      fieldError(field) ? "border-input-border-error" : "border-input",
    );

  return (
    <div className="max-w-xl">
      <h1>Add Judge Record</h1>

      {success && (
        <div
          role="status"
          className="p-4 bg-badge-success-bg text-badge-success-text rounded-md mb-4"
        >
          Judge created successfully! Redirecting...
        </div>
      )}

      {errors.length > 0 && (
        <div
          role="alert"
          className="p-4 bg-error-bg text-error-text rounded-md mb-4"
        >
          {errors.map((err, i) => (
            <p key={i}>
              {err.field ? `${err.field}: ` : ""}
              {err.message}
            </p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Location Selection */}
        <fieldset className="border border-border p-4 rounded-md mb-6">
          <legend className="font-semibold px-2">Court Assignment</legend>

          <div className="mb-4">
            <label htmlFor="state" className="font-medium text-sm">
              State *
            </label>
            <select
              id="state"
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className={inputClasses("stateId")}
              required
            >
              <option value="">Select state...</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.abbreviation})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="county" className="font-medium text-sm">
              County *
            </label>
            <select
              id="county"
              value={selectedCountyId}
              onChange={(e) => setSelectedCountyId(e.target.value)}
              className={inputClasses("countyId")}
              disabled={!selectedStateId}
              required
            >
              <option value="">Select county...</option>
              {counties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-2">
            <label htmlFor="court" className="font-medium text-sm">
              Court *
            </label>
            <div className="flex gap-2">
              <select
                id="court"
                value={selectedCourtId}
                onChange={(e) => setSelectedCourtId(e.target.value)}
                className={cn(inputClasses("courtId"), "flex-1")}
                disabled={!selectedCountyId}
                required={!showNewCourt}
              >
                <option value="">Select court...</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.type}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCourt(!showNewCourt)}
                disabled={!selectedCountyId}
                className={cn(
                  "px-3 py-2 border border-input rounded-md bg-background text-foreground whitespace-nowrap text-sm",
                  selectedCountyId
                    ? "cursor-pointer hover:bg-muted transition-colors"
                    : "cursor-not-allowed opacity-50",
                )}
              >
                {showNewCourt ? "Cancel" : "+ New"}
              </button>
            </div>
            {showNewCourt && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="e.g., District Court"
                  value={newCourtType}
                  onChange={(e) => setNewCourtType(e.target.value)}
                  className={cn(inputClasses("newCourt"), "flex-1")}
                />
                <button
                  type="button"
                  onClick={handleCreateCourt}
                  className="px-4 py-2 bg-primary text-btn-primary-text border-none rounded-md cursor-pointer text-sm"
                >
                  Create
                </button>
              </div>
            )}
          </div>
        </fieldset>

        {/* Judge Information */}
        <fieldset className="border border-border p-4 rounded-md mb-6">
          <legend className="font-semibold px-2">Judge Information</legend>

          <div className="mb-4">
            <label htmlFor="fullName" className="font-medium text-sm">
              Full Name *
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., John A. Smith"
              className={inputClasses("fullName")}
              aria-describedby={
                fieldError("fullName") ? "fullName-error" : undefined
              }
              aria-invalid={!!fieldError("fullName")}
              required
            />
            {fieldError("fullName") && (
              <p id="fullName-error" className="text-error-text text-xs mt-1">
                {fieldError("fullName")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
            <div>
              <label htmlFor="termStart" className="font-medium text-sm">
                Term Start
              </label>
              <input
                id="termStart"
                type="date"
                value={termStart}
                onChange={(e) => setTermStart(e.target.value)}
                className={inputClasses("termStart")}
              />
            </div>
            <div>
              <label htmlFor="termEnd" className="font-medium text-sm">
                Term End
              </label>
              <input
                id="termEnd"
                type="date"
                value={termEnd}
                onChange={(e) => setTermEnd(e.target.value)}
                className={inputClasses("termEnd")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
            <div>
              <label htmlFor="selectionMethod" className="font-medium text-sm">
                Selection Method
              </label>
              <select
                id="selectionMethod"
                value={selectionMethod}
                onChange={(e) => setSelectionMethod(e.target.value)}
                className={inputClasses("selectionMethod")}
              >
                <option value="">Not specified</option>
                <option value="Elected">Elected</option>
                <option value="Appointed">Appointed</option>
                <option value="Retained">Retained</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="appointingAuthority"
                className="font-medium text-sm"
              >
                Appointing Authority
              </label>
              <input
                id="appointingAuthority"
                type="text"
                value={appointingAuthority}
                onChange={(e) => setAppointingAuthority(e.target.value)}
                placeholder="e.g., Governor"
                className={inputClasses("appointingAuthority")}
              />
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="politicalAffiliation"
              className="font-medium text-sm"
            >
              Political Affiliation
            </label>
            <input
              id="politicalAffiliation"
              type="text"
              value={politicalAffiliation}
              onChange={(e) => setPoliticalAffiliation(e.target.value)}
              placeholder="e.g., Republican, Democrat"
              className={inputClasses("politicalAffiliation")}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="education" className="font-medium text-sm">
              Education
            </label>
            <textarea
              id="education"
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              placeholder="e.g., J.D., University of Texas School of Law"
              rows={2}
              className={inputClasses("education")}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="priorExperience" className="font-medium text-sm">
              Prior Experience
            </label>
            <textarea
              id="priorExperience"
              value={priorExperience}
              onChange={(e) => setPriorExperience(e.target.value)}
              placeholder="e.g., Assistant District Attorney, 2005-2015"
              rows={2}
              className={inputClasses("priorExperience")}
            />
          </div>
        </fieldset>

        {/* Source */}
        <fieldset className="border border-border p-4 rounded-md mb-6">
          <legend className="font-semibold px-2">Source Attribution</legend>

          <div>
            <label htmlFor="sourceUrl" className="font-medium text-sm">
              Source URL *
            </label>
            <input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.courts.gov/judges/..."
              className={inputClasses("sourceUrl")}
              aria-describedby={
                fieldError("sourceUrl") ? "sourceUrl-error" : "sourceUrl-hint"
              }
              aria-invalid={!!fieldError("sourceUrl")}
              required
            />
            {fieldError("sourceUrl") && (
              <p id="sourceUrl-error" className="text-error-text text-xs mt-1">
                {fieldError("sourceUrl")}
              </p>
            )}
            <p
              id="sourceUrl-hint"
              className="text-xs text-muted-foreground mt-1"
            >
              Required per Constitution I — link to the public government source
              for this judge record.
            </p>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "px-8 py-3 text-btn-primary-text border-none rounded-md text-base font-semibold",
            submitting
              ? "bg-btn-primary-disabled cursor-not-allowed"
              : "bg-primary cursor-pointer hover:bg-primary/90 transition-colors",
          )}
        >
          {submitting ? "Creating..." : "Create Judge Record"}
        </button>
      </form>
    </div>
  );
}
