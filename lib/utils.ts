import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names and resolve Tailwind class conflicts
 * (e.g. `cn("p-2", condition && "p-4")` -> "p-4", not both).
 * Used throughout components/ starting in Part 5.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
