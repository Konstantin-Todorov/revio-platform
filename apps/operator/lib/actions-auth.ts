"use server";

import { redirect } from "next/navigation";
import { prisma } from "@revio/db";
import { verifyPassword, signSession, setSessionCookie, clearSessionCookie } from "./auth";

export type LoginResult = { error?: string };

export async function login(_prev: LoginResult | null, fd: FormData): Promise<LoginResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const op = await prisma.operatorUser.findUnique({ where: { email } });
  if (!op || !(await verifyPassword(password, op.passwordHash))) {
    return { error: "Invalid email or password." };
  }

  await setSessionCookie(await signSession({ kind: "operator", sub: op.id }));
  redirect("/overview");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
