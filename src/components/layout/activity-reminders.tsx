// src/components/layout/activity-reminders.tsx
// Gửi thông báo trình duyệt khi đến giờ một hoạt động. Chỉ chạy khi app đang mở.
"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Block {
  id: string;
  activityType: string;
  title: string | null;
  startTime: string;
}
interface Schedule { blocks: Block[] }

const todayStr = () => new Date().toLocaleDateString("en-CA");

export function ActivityReminders() {
  const { t } = useI18n();
  const blocksRef = useRef<Block[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  // Tải lịch hôm nay (và làm mới mỗi 5 phút)
  useEffect(() => {
    let alive = true;
    const fetchToday = async () => {
      try {
        const data = (await api.getSchedule(todayStr(), 1)) as Schedule[];
        if (alive) blocksRef.current = data[0]?.blocks ?? [];
      } catch {
        /* im lặng */
      }
    };
    void fetchToday();
    const refresh = setInterval(fetchToday, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(refresh);
    };
  }, []);

  // Mỗi 30s: nếu có hoạt động vừa bắt đầu (trong vòng 1 phút) thì báo
  useEffect(() => {
    const label = (b: Block) =>
      b.activityType === "TASK" ? b.title ?? t("act.TASK") : t(`act.${b.activityType}`);

    const tick = () => {
      if (typeof Notification === "undefined") return;
      if (localStorage.getItem("reminders") !== "on" || Notification.permission !== "granted") return;
      const now = Date.now();
      for (const b of blocksRef.current) {
        const start = new Date(b.startTime).getTime();
        const key = `${todayStr()}:${b.id}`;
        if (start <= now && now - start < 60_000 && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          try {
            new Notification(t("rem.title"), { body: t("rem.timeFor", { x: label(b) }) });
          } catch {
            /* im lặng */
          }
        }
      }
    };
    const id = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(id);
  }, [t]);

  return null;
}
