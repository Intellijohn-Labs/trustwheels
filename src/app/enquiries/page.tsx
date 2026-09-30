"use client";

import { useState } from "react";
import { ChartColumn, Clock, Plus, Siren, Trash2, UserPlus } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { Button, PageHeader, Panel, Pill, Segmented } from "@/components/ui";
import { EnquiryDialog, LogCallDialog, StageDialog } from "@/components/panels/lead-dialogs";
import { FollowUpChips, FollowUpsTable, LeadCell, nextCallText } from "@/components/panels/follow-ups";
import { ConfirmDeleteDialog } from "@/components/panels/confirm-delete-dialog";
import { RowCheckbox, SelectAllCheckbox, SelectionToolbar, useSelection } from "@/components/selection";
import { formatDateTime } from "@/lib/format";
import { useRole } from "@/lib/role-context";
import { useNow } from "@/lib/use-now";
import { conversionBy, deleteLead, deleteLeads, isOpenLead, sourceLabel, stageLabel, useScopedLeads, type ConversionRow, type FollowUpDay, type Lead, type LeadSource } from "@/lib/leads";

type Filter = "open" | "booked" | "lost" | "all";

const FILTERS: { value: Filter; label: string; test: (l: Lead) => boolean }[] = [
  { value: "open", label: "Open", test: isOpenLead },
  { value: "booked", label: "Booked", test: (l) => l.stage === "booked" },
  { value: "lost", label: "Lost", test: (l) => l.stage === "lost" },
  { value: "all", label: "All", test: () => true },
];

export default function EnquiriesPage() {
  const { can } = useRole();
  const { leads, ready } = useScopedLeads();
  const now = useNow(30_000);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [logging, setLogging] = useState<{ lead: Lead; day: FollowUpDay }>();
  const [staging, setStaging] = useState<Lead>();
  const manage = can("leads.manage");
  const canDelete = can("leads.delete");
  const label = (l: Lead) => `${l.name} · ${l.phone}`;

  const current = FILTERS.find((f) => f.value === filter)!;
  const rows = leads.filter(current.test).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selection = useSelection(rows, (l) => l.id);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; labels: string[] } | null>(null);

  const columns: Column<Lead>[] = [
    ...(canDelete
      ? [
          {
            header: <SelectAllCheckbox checked={selection.allVisibleSelected} indeterminate={selection.count > 0} onChange={selection.toggleAll} label="Select all shown enquiries" />,
            cell: (l: Lead) => <RowCheckbox checked={selection.isSelected(l.id)} onChange={() => selection.toggle(l.id)} label={`Select ${label(l)}`} />,
          } satisfies Column<Lead>,
        ]
      : []),
    { header: "Customer", cell: (l) => <LeadCell lead={l} /> },
    { header: "Interested in", cell: (l) => <span className="line-clamp-2 min-w-40">{l.interest || "—"}</span> },
    { header: "Received", cell: (l) => <span className="whitespace-nowrap text-muted">{formatDateTime(l.createdAt)}</span> },
    {
      header: "Stage",
      cell: (l) => (
        <div>
          <Pill tone={l.stage === "booked" ? "ok" : l.stage === "lost" ? "neutral" : "brand"}>{stageLabel(l.stage)}</Pill>
          {l.lossReason && <p className="mt-0.5 text-xs text-muted">{l.lossReason}</p>}
        </div>
      ),
    },
    {
      header: "Follow-ups",
      cell: (l) => {
        const next = nextCallText(l, now);
        return (
          <div className="min-w-44 space-y-1">
            <FollowUpChips lead={l} now={now} />
            {next && (
              <p className={next.state === "overdue" ? "text-xs font-semibold text-danger" : "text-xs text-muted"}>
                {next.state === "overdue" ? `Day ${next.day} call missed` : `Day ${next.day} call ${next.text}`}
              </p>
            )}
          </div>
        );
      },
    },
    { header: "Assigned to", cell: (l) => <span className="whitespace-nowrap">{l.assignedTo}</span> },
  ];
  if (manage || canDelete)
    columns.push({
      header: "",
      align: "right",
      cell: (l) => {
        const next = nextCallText(l, now);
        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            {manage && next && next.state !== "upcoming" && (
              <Button size="sm" variant={next.state === "overdue" ? "danger" : "primary"} onClick={() => setLogging({ lead: l, day: next.day })}>
                Log day {next.day}
              </Button>
            )}
            {manage && (
              <Button size="sm" onClick={() => setStaging(l)}>
                Stage
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ ids: [l.id], labels: [label(l)] })} aria-label={`Delete ${label(l)}`}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        );
      },
    });

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<UserPlus className="size-6 text-brand" />}
        title="Enquiries"
        description="Every enquiry gets a call on day 2, 3 and 4. A missed call is escalated as Code Red."
        actions={
          manage && (
            <Button variant="primary" size="lg" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> New enquiry
            </Button>
          )
        }
      />

      <FollowUpsTable kind="overdue" />
      <FollowUpsTable kind="due" />

      {canDelete && selection.count > 0 && (
        <SelectionToolbar
          count={selection.count}
          noun="enquiry"
          nounPlural="enquiries"
          onClear={selection.clear}
          onDelete={() =>
            setConfirmDelete({
              ids: [...selection.selected],
              labels: rows.filter((l) => selection.selected.has(l.id)).map(label),
            })
          }
        />
      )}

      <Panel
        flush
        title={`All enquiries · ${leads.length}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> D2/D3/D4 = day 2, 3, 4 calls
            </span>
            <span className="inline-flex items-center gap-1">
              <Siren className="size-3" /> missed
            </span>
          </span>
        }
      >
        <div className="border-b border-line p-3 sm:max-w-md">
          <Segmented name="Filter enquiries" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f.value, label: `${f.label} ${leads.filter(f.test).length}` }))} />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(l) => l.id} empty={ready ? "No enquiries here." : "Loading…"} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <ConversionTable title="Conversion by source" rows={conversionBy(leads, (l) => l.source, (k) => sourceLabel(k as LeadSource))} />
        <ConversionTable title="Conversion by executive" rows={conversionBy(leads, (l) => l.assignedTo)} />
      </div>

      {adding && <EnquiryDialog onClose={() => setAdding(false)} />}
      {logging && <LogCallDialog lead={logging.lead} day={logging.day} onClose={() => setLogging(undefined)} />}
      {staging && <StageDialog lead={staging} onClose={() => setStaging(undefined)} />}
      {confirmDelete && (
        <ConfirmDeleteDialog
          count={confirmDelete.ids.length}
          items={confirmDelete.labels}
          noun="enquiry"
          nounPlural="enquiries"
          onConfirm={async () => {
            if (confirmDelete.ids.length === 1) await deleteLead(confirmDelete.ids[0]);
            else await deleteLeads(confirmDelete.ids);
            selection.clear();
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function ConversionTable({ title, rows }: { title: string; rows: ConversionRow[] }) {
  const total = rows.reduce((s, r) => ({ leads: s.leads + r.leads, booked: s.booked + r.booked }), { leads: 0, booked: 0 });
  return (
    <Panel flush title={<span className="inline-flex items-center gap-1.5"><ChartColumn className="size-4 text-muted" /> {title}</span>}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-sunken/60 text-left text-xs text-muted">
            <th className="px-4 py-2 font-medium"></th>
            <th className="px-4 py-2 text-right font-medium">Leads</th>
            <th className="px-4 py-2 text-right font-medium">Booked</th>
            <th className="px-4 py-2 text-right font-medium">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="px-4 py-2">{r.label}</td>
              <td className="px-4 py-2 text-right">{r.leads}</td>
              <td className="px-4 py-2 text-right">{r.booked}</td>
              <td className="px-4 py-2 text-right">{Math.round(r.rate * 100)}%</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="px-4 py-2">Total</td>
            <td className="px-4 py-2 text-right">{total.leads}</td>
            <td className="px-4 py-2 text-right">{total.booked}</td>
            <td className="px-4 py-2 text-right">{total.leads ? Math.round((total.booked / total.leads) * 100) : 0}%</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}
