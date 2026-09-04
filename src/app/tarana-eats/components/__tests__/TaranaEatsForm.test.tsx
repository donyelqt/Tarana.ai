import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/use-toast";
import TaranaEatsForm from "../TaranaEatsForm";
import { cuisineOptions } from "../../data/formOptions";

// Radix Select needs these DOM APIs that jsdom lacks.
window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLElement.prototype.hasPointerCapture = jest.fn();
window.HTMLElement.prototype.setPointerCapture = jest.fn();
window.HTMLElement.prototype.releasePointerCapture = jest.fn();
window.ResizeObserver = jest.fn(() => ({ observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(), }));

function renderForm() {
  return render(
    <ToastProvider>
      <TaranaEatsForm onGenerate={jest.fn()} />
    </ToastProvider>
  );
}

describe("TaranaEatsForm cuisine Select (shadcn)", () => {
  it("shows the current cuisine in the trigger", () => {
    renderForm();
    expect(screen.getByRole("combobox", { name: "Cuisine" })).toHaveTextContent(
      cuisineOptions[0]
    );
  });

  it("lists every cuisine option when opened", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("combobox", { name: "Cuisine" }));
    for (const opt of cuisineOptions) {
      expect(await screen.findByRole("option", { name: opt })).toBeInTheDocument();
    }
  });

  it("updates the trigger on selection", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("combobox", { name: "Cuisine" }));
    await user.click(await screen.findByRole("option", { name: "Korean" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Cuisine" })).toHaveTextContent("Korean")
    );
  });
});