import { Requests } from "@/components/help/Requests";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <Requests selectedId={(await params).id} />;
}
