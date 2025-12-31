import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 39);
}

export function sanitizeChatMessage(text: string, maxLength: number = 500): string {
  // Strip HTML/script tags
  const withoutHtml = text.replace(/<[^>]*>/g, "");
  // Trim and limit length
  return withoutHtml.trim().slice(0, maxLength);
}
