"use server";

import { redirect } from "next/navigation";
import { forSystem } from "@revio/db";
import { verifyPassword, signSession, setSessionCookie, clearSessionCookie } from "./auth";

// Login resolves a user by email before any tenant context exists → bypass RLS (app.bypass=on).
const prisma = forSystem();

export type LoginResult = { error?: string };

export async function login(_prev: LoginResult | null, fd: FormData): Promise<LoginResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  if (user.tenant.status !== "active") return { error: "This account is suspended — contact Revio." };
  if (!user.tenant.hasPms) return { error: "RevioPMS isn’t enabled for this hotel." };

  await setSessionCookie(await signSession({ kind: "hotel", sub: user.id }));
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
