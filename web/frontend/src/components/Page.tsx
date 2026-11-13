import { cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";
import { TableCell, TableRow } from "./ui/table";

/** Standard page frame: title row with optional description and actions, then content. */
export function Page({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1360px] space-y-5 px-4 py-5 sm:px-8 sm:py-7", className)}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.375rem] leading-tight font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

/** Placeholder rows shown while a table's first page of data loads. */
export function TableSkeletonRows({ columns, rows = 4 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} className="hover:bg-transparent">
          {Array.from({ length: columns }, (_, col) => (
            <TableCell key={col}>
              <Skeleton className="h-4" style={{ width: `${col === 0 ? 70 : 40 + ((row + col) % 3) * 15}%` }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Centered message for an empty table or list, with an optional next step. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center whitespace-normal">
      {Icon ? (
        <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
