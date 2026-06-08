/**
 * Утилиты для poster bot (даты, время, admin check).
 */

import { isPosterAdmin } from "./config";

export function parseScheduleDateTime(dateTimeStr: string): string | null {
  const match = dateTimeStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, dateStr, hourStr, minuteStr] = match;
  const dateTime = `${dateStr}T${hourStr}:${minuteStr}:00+03:00`;
  const date = new Date(dateTime);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const utc3Date = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const year = utc3Date.getUTCFullYear();
  const month = String(utc3Date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc3Date.getUTCDate()).padStart(2, "0");
  const hours = String(utc3Date.getUTCHours()).padStart(2, "0");
  const minutes = String(utc3Date.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month}.${year}, ${hours}:${minutes}`;
}

export function getCurrentDateTime(): string {
  const now = new Date();
  const utc3Date = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const weekdays = [
    "воскресенье",
    "понедельник",
    "вторник",
    "среда",
    "четверг",
    "пятница",
    "суббота",
  ];
  const weekday = weekdays[utc3Date.getUTCDay()];

  const year = utc3Date.getUTCFullYear();
  const month = String(utc3Date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc3Date.getUTCDate()).padStart(2, "0");
  const hours = String(utc3Date.getUTCHours()).padStart(2, "0");
  const minutes = String(utc3Date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(utc3Date.getUTCSeconds()).padStart(2, "0");

  return `${weekday}, ${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
}

export function isAdmin(userId: number): boolean {
  return isPosterAdmin(userId);
}
