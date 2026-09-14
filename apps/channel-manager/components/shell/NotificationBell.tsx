"use client";

import { useRouter } from "next/navigation";
import { NotificationCenter } from "@revio/ui/notification-center";
import type { NotificationFeed } from "@revio/core";
import {
  loadNotifications, markAllNotificationsRead, markNotificationRead,
} from "@/lib/actions-notifications";

/**
 * RevioLink's notification centre — the shared panel, wired to this product's own feed.
 *
 * ⚠️ This file used to hold a 45-line dropdown that was **byte-identical** in all four apps. They
 * had not diverged yet, which is the only reason it was cheap to fix: four copies of one thing are
 * four things to change, and the copy that gets missed is the one that then tells somebody
 * something untrue. The panel is `@revio/ui/notification-center` now; what stays here is the wiring
 * that only this product can supply.
 */
export function NotificationBell({ initial, timeZone }: { initial: NotificationFeed; timeZone: string }) {
  const router = useRouter();
  return (
    <NotificationCenter
      initial={initial}
      timeZone={timeZone}
      load={loadNotifications}
      markRead={markNotificationRead}
      markAllRead={markAllNotificationsRead}
      onNavigate={(href) => router.push(href)}
    />
  );
}
