import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// jsdom in vitest v4 ships a locked `window.localStorage` whose
// prototype methods (removeItem, clear) are not reliably installed
// in our environment. Replace it with an in-memory Storage-compatible
// object so components that persist state (NotesPage, AlertsPage,
// TimelineScrubber reset, etc.) can read and write freely in tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const memoryStorage = new MemoryStorage();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: memoryStorage
});

beforeEach(() => {
  memoryStorage.clear();
});

afterEach(() => {
  cleanup();
});
