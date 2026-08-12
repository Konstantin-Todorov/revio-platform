"use server";

import { redirect } from "next/navigation";
import { checkLoginAllowed, forSystem, recordLoginFailure, recordLoginSuccess } from "@revio/db";
import { verifyPassword, signSession, setSessionCookie, clearSessionCookie } from "./auth";

// Login resolves a user by email before any tenant context exists → bypass RLS (app.bypass=on).
const prisma = forSystem();

export type LoginResult = { error?: string };

export async function login(_prev: LoginResult | null, fd: FormData): Promise<LoginResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  // Brute-force gate. Checked BEFORE the password, so a locked address never reaches bcrypt — which
  // also sheds the CPU cost an attacker was trying to impose. Counted against the email as typed
  // whether or not it exists, so the lockout message cannot be used to discover who has an account.
  const gate = await checkLoginAllowed("cm", email);
  if (!gate.allowed) return { error: gate.message };

  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    await recordLoginFailure("cm", email);
    return { error: "Invalid email or password." };
  }
  await recordLoginSuccess("cm", email);
  if (user.tenant.status !== "active") return { error: "This account is suspended — contact Revio." };
  if (!user.tenant.hasChannelManager) return { error: "RevioLink isn’t enabled for this hotel." };

  await setSessionCookie(await signSession({ kind: "hotel", sub: user.id }));
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
