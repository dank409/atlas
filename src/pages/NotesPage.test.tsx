import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotesPage } from "./NotesPage";

describe("NotesPage", () => {
  // Storage is reset globally in `src/test/setup.ts` before each test.

  it("renders the scratchpad panel with an unsaved badge when empty", () => {
    render(<NotesPage />);
    expect(screen.getByText("SCRATCHPAD")).toBeDefined();
  });

  it("hydrates from localStorage on mount", async () => {
    window.localStorage.setItem("atlas.notes.v1", "PRE-LOADED NOTE");
    render(<NotesPage />);
    const textarea = screen.getByLabelText("Terminal notes scratchpad") as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe("PRE-LOADED NOTE"));
  });

  it("persists typed content to localStorage after the debounce fires", async () => {
    vi.useFakeTimers();
    try {
      render(<NotesPage />);
      const textarea = screen.getByLabelText("Terminal notes scratchpad") as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "HYPOTHESIS" } });
      vi.advanceTimersByTime(400);
      expect(window.localStorage.getItem("atlas.notes.v1")).toBe("HYPOTHESIS");
    } finally {
      vi.useRealTimers();
    }
  });
});
