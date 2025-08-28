"use client";

import { useEffect, useRef } from "react";
import { toast as showToast } from "@/hooks/use-toast";

/**
 * useReminders
 * Schedules in-app reminders (toasts) and optional browser notifications for upcoming tasks.
 *
 * tasks: Array<{ id: string|number, label: string, scheduled_start: string | Date }>
 * options:
 *  - leadMinutes: number[] lead offsets in minutes before the scheduled_start to trigger reminders (e.g., [10, 0])
 *  - category: string identifier used in dedup keys (e.g., 'plan' | 'tasks')
 */
export function useReminders(tasks = [], options = {}) {
  const { leadMinutes = [10, 0], category = "tasks" } = options;
  const timersRef = useRef([]);
  const firedRef = useRef(new Set());

  useEffect(() => {
    // Clear existing timers
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];

    const now = Date.now();
    const maxAhead = 48 * 60 * 60 * 1000; // only schedule within next 48h

    const schedule = (task, lead) => {
      try {
        if (!task?.scheduled_start) return;
        const start = new Date(task.scheduled_start).getTime();
        if (isNaN(start)) return;
        const triggerAt = start - lead * 60 * 1000;
        const delay = triggerAt - Date.now();
        const key = `${category}:${task.id || task.key || task.label}:${new Date(start).toISOString()}:${lead}`;

        if (firedRef.current.has(key)) return;
        if (delay <= 0) return; // already passed
        if (delay > maxAhead) return; // too far in the future

        const id = setTimeout(() => {
          // Mark fired to avoid duplicates if effect re-runs after trigger
          firedRef.current.add(key);
          const when = lead === 0 ? "Starting now" : `Starts in ${lead} min`;
          const title = "Reminder";
          const description = `${task.label || "Task"} — ${when}`;

          // In-app toast
          try {
            showToast({ title, description });
          } catch {}

          // Browser Notification (if granted)
          try {
            if (typeof window !== "undefined" && "Notification" in window) {
              if (Notification.permission === "granted") {
                new Notification(title, { body: description });
              }
            }
          } catch {}

          // Persist to backend notifications
          try {
            fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'reminder',
                title,
                message: description,
                meta: {
                  origin: 'useReminders',
                  lead_minutes: lead,
                  task_id: task.id || task.key || null,
                  scheduled_start: task.scheduled_start || null,
                  category
                }
              })
            }).catch(() => {})
          } catch {}
        }, delay);
        timersRef.current.push(id);
      } catch {}
    };

    // Deduplicate by (id + start)
    const unique = new Map();
    (tasks || []).forEach((t) => {
      if (!t?.scheduled_start) return;
      const k = `${t.id || t.key || t.label}:${new Date(t.scheduled_start).toISOString()}`;
      if (!unique.has(k)) unique.set(k, t);
    });

    unique.forEach((task) => {
      leadMinutes.forEach((m) => schedule(task, m));
    });

    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
  }, [JSON.stringify(tasks), JSON.stringify(leadMinutes), category]);
}

/**
 * Helper to request browser notification permission from UI if needed.
 */
export function requestNotificationPermission() {
  try {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") Notification.requestPermission();
    }
  } catch {}
}
