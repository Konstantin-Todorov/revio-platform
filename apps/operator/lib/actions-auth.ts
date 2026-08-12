"use server";

import { redirect } from "next/navigation";
import { OPERATOR_LOGIN_GATE } from "@revio/core";
import { checkLoginAllowed, forSystem, recordLoginFailure, recordLoginSuccess } from "@revio/db";
import { verifyPassword, signSession, setSessionCookie, clearSessionCookie } from "./auth";

// Operator login resolves staff before any tenant context → bypass RLS (app.bypass=on).
const prisma = forSystem();

export type LoginResult = { error?: string };

export async function login(_prev: LoginResult | null, fd: FormData): Promise<LoginResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  // Brute-force gate, on the stricter OPERATOR policy — 3 attempts, not 5, and hours rather than
  // minutes at the cap. Not because operators are less trusted, but because one guessed password
  // here reaches every tenant on the platform, and there are only ever a handful of these accounts,
  // so the tighter limit costs nobody anything.
  const gate = await checkLoginAllowed("operator", email, OPERATOR_LOGIN_GATE);
  if (!gate.allowed) return { error: gate.message };

  const op = await prisma.operatorUser.findUnique({ where: { email } });
  if (!op || !(await verifyPassword(password, op.passwordHash))) {
    await recordLoginFailure("operator", email, OPERATOR_LOGIN_GATE);
    return { error: "Invalid email or password." };
  }
  await recordLoginSuccess("operator", email);

  await setSessionCookie(await signSession({ kind: "operator", sub: op.id }));
  redirect("/overview");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
