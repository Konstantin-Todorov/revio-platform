"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_PROPERTY_COOKIE, GROUP_SCOPE } from "./session";

/** Switch the active workspace (property). Dev affordance standing in for "log in as this tenant".
 *  Re-scopes every screen to the chosen property's tenant. */
export async function setActiveProperty(propertyId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_PROPERTY_COOKIE, propertyId, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** Switch to portfolio (group) scope — Dashboard + Analytics aggregate across every property
 *  (CRS-GUIDE §4.1). Operational screens keep auto-selecting the first property. */
export async function setGroupScope(): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_PROPERTY_COOKIE, GROUP_SCOPE, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
}
