import { CATEGORY_COLORS } from "@/lib/pqrs/category-colors";
import type { Category } from "@/lib/pqrs/labels";

/** Nombre de la categoría con su color fijo. El texto siempre acompaña al color. */
export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: CATEGORY_COLORS[category] }}
      />
      {category}
    </span>
  );
}
