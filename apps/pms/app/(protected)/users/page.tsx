import { PageHeader } from "@/components/ui/primitives";
import { getStaff } from "@/lib/data";
import { UsersManager } from "@/components/users/UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { property, users, meId, canManage } = await getStaff();

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle={`${property.name} · who can sign in and what they can touch — a scoped view onto the shared Revio identity`}
      />
      <UsersManager users={users} meId={meId} canManage={canManage} />
    </div>
  );
}
