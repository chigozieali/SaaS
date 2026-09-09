import { CalendarCheck } from "lucide-react";
import { db } from "@/lib/prisma";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UpcomingReceivables } from "@/components/dashboard/upcoming-receivables";

const IN_SEVEN_DAYS = new Date(Date.now() + 7 * 86400000);

export async function UpcomingReceivablesCard({
  organizationId,
  currency,
}: {
  organizationId: string;
  currency: string;
}) {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      status: { in: ["sent", "partial", "overdue"] },
      dueDate: { lte: IN_SEVEN_DAYS },
    },
    include: { customer: true },
    take: 5,
    orderBy: { dueDate: "asc" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-4 w-4" /> Upcoming Receivables
        </CardTitle>
        <CardDescription>Invoices due within 7 days</CardDescription>
      </CardHeader>
      <UpcomingReceivables
        currency={currency}
        rows={invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer.name,
          amount: Number(inv.total),
        }))}
      />
    </Card>
  );
}