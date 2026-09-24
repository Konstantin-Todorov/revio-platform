import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 transition-colors hover:text-ink-900">
      <ArrowLeft className="h-3.5 w-3.5" /> {children}
    </Link>
  );
}
