import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** PostgreSQL `numeric` / decimals often serialize as strings over JSON. */
export function normalizePartPrice(price: unknown): number {
  if (typeof price === "number" && Number.isFinite(price)) return price;
  if (typeof price === "string") {
    const n = Number.parseFloat(price);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
