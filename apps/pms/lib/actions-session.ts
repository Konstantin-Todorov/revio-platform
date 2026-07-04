"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_PROPERTY_COOKIE } from "./session";

/** Switch the active workspace (property). Re-scopes every screen to the chosen property's tenant. */
export async function setActiveProperty(propertyId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_PROPERTY_COOKIE, propertyId, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
}
