/** Shown when a delete was refused because the channel manager still sells the thing. */
export function BlockedNotice({ name }: { name?: string | undefined }) {
  if (!name) return null;
  return (
    <div role="alert" className="rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning-700">
      “{name}” is mapped to the channel manager and can’t be deleted — unmap it in RevioLink → Mapping first.
    </div>
  );
}
