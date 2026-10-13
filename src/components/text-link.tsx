import Link from "next/link";
import { cn } from "@/lib/utils";

export const TEXT_LINK_CLASS =
  "underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return <Link className={cn(TEXT_LINK_CLASS, className)} {...props} />;
}
