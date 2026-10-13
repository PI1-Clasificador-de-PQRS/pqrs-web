import Link from "next/link";
import { CategoryBadge } from "@/components/category-badge";
import { TEXT_LINK_CLASS } from "@/components/text-link";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Schemas } from "@/lib/api/client";
import { ENGINE_LABELS, SOURCE_LABELS } from "@/lib/pqrs/labels";
import { formatDateTime } from "@/lib/time/format";

export const PREVIEW_CHARS = 120;

/** Recorta por caracteres (no por unidades UTF-16) para no partir una tilde o un emoji. */
export function truncateText(text: string, max = PREVIEW_CHARS): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max).join("").trimEnd()}…`;
}

export function HistoryTable({
  items,
  busy,
}: {
  items: readonly Schemas["ClassificationOut"][];
  busy: boolean;
}) {
  return (
    <div aria-busy={busy} className={busy ? "opacity-60 transition-opacity" : undefined}>
      <Table>
        <TableCaption className="sr-only">
          Clasificaciones, de la más reciente a la más antigua
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Texto anonimizado</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Motor</TableHead>
            <TableHead>Origen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="align-top whitespace-nowrap">
                <Link href={`/historial/${item.id}`} className={TEXT_LINK_CLASS}>
                  {formatDateTime(item.created_at)}
                </Link>
              </TableCell>
              <TableCell
                className="max-w-md align-top whitespace-normal"
                title={item.text_anonymized}
              >
                {truncateText(item.text_anonymized)}
              </TableCell>
              <TableCell className="align-top">
                <CategoryBadge category={item.category} />
              </TableCell>
              <TableCell className="align-top">{ENGINE_LABELS[item.model]}</TableCell>
              <TableCell className="align-top">{SOURCE_LABELS[item.source]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
