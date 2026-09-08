"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatMoney } from "@/lib/utils";

type ReceivableRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  currency: string;
};

const columns: ColumnDef<ReceivableRow>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Invoice",
    cell: ({ row }) => <span className="font-medium">{row.original.invoiceNumber}</span>,
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => <span>{row.original.customerName}</span>,
  },
  {
    accessorFn: (r) => Number(r.amount),
    id: "amount",
    header: "Amount",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => <span>{formatMoney(Number(row.original.amount), row.original.currency)}</span>,
  },
];

export function UpcomingReceivables({
  rows,
  currency,
}: {
  rows: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
  }[];
  currency: string;
}) {
  if (rows.length === 0) {
    return (
      <CardContent>
        <p className="py-6 text-center text-sm text-muted-foreground">No invoices due soon.</p>
      </CardContent>
    );
  }
  const data: ReceivableRow[] = rows.map((r) => ({ ...r, currency }));
  return (
    <CardContent>
      <DataTable
        columns={columns}
        data={data}
        pageSize={5}
        pageSizeOptions={[5, 10]}
        emptyMessage="No invoices due soon."
      />
    </CardContent>
  );
}