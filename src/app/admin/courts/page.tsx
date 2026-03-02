import { prisma } from "@/lib/db";
import BulkCourtForm from "@/components/admin/BulkCourtForm";

export const metadata = {
  title: "Bulk Court Creation — Admin",
};

export default async function AdminCourtsPage() {
  const states = await prisma.state.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="mb-6">Bulk Court Creation</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        Create court types across all counties in a state. This is required
        before importing judges — courts are the parent records for judge
        assignments.
      </p>
      <BulkCourtForm states={states} />
    </div>
  );
}
