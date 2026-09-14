"use client";

import { useRouter } from "next/navigation";
import { NotificationCenter } from "@revio/ui/notification-center";
import type { NotificationFeed } from "@revio/core";
import {
  loadNotifications, markAllNotificationsRead, markNotificationRead,
} from "@/lib/actions-notifications";

/**
 * RevioPMS's notification centre — the shared panel, wired to this product's own feed.
 *
 * ⚠️ This file used to hold a dropdown that was byte-identical in all four apps. See
 * `@revio/ui/notification-center` for why that was worth removing before the copies diverged.
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
