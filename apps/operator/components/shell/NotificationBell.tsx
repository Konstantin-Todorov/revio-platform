"use client";

import { useRouter } from "next/navigation";
import { NotificationCenter } from "@revio/ui/notification-center";
import type { NotificationFeed } from "@revio/core";
import {
  loadNotifications, markAllNotificationsRead, markNotificationRead,
} from "@/lib/actions-notifications";

/**
 * The Operator console's notification centre — the shared panel, wired to the cross-tenant feed.
 *
 * ⚠️ This file used to hold a dropdown byte-identical to the one in all three hotel apps. See
 * `@revio/ui/notification-center`.
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
