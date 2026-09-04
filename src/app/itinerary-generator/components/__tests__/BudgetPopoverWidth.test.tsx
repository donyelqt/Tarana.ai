import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import ItineraryForm from "../ItineraryForm";

window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLElement.prototype.hasPointerCapture = jest.fn();
window.HTMLElement.prototype.setPointerCapture = jest.fn();
window.HTMLElement.prototype.releasePointerCapture = jest.fn();
window.ResizeObserver = jest.fn(() => ({ observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(), }));

const noopDispatch = (() => {}) as unknown as React.Dispatch<React.SetStateAction<any>>;

const baseProps: React.ComponentProps<typeof ItineraryForm> = {
  showPreview: false,
  isGenerating: false,
  isLoadingItinerary: false,
  onSubmitItinerary: jest.fn(),
  weatherData: null,
  budget: "",
  setBudget: noopDispatch,
  pax: "1",
  setPax: noopDispatch,
  duration: "2 Days",
  setDuration: noopDispatch,
  dates: { start: undefined, end: undefined },
  setDates: noopDispatch,
  selectedInterests: [],
  setSelectedInterests: noopDispatch,
  handleInterest: jest.fn(),
  interests: [],
  budgetOptions: ["less than 3k", "3k - 5k"],
  paxOptions: ["1", "2"],
  durationOptions: ["1 Day", "2 Days"],
  trafficAware: true,
  setTrafficAware: noopDispatch,
  selectedCity: "baguio",
  setSelectedCity: noopDispatch,
};

describe("ItineraryForm budget popover width", () => {
  it("content tracks the trigger width instead of a fixed 700px", async () => {
    render(
      <ToastProvider>
        <ItineraryForm {...baseProps} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("combobox"));
    const popover = await screen.findByText("less than 3k");
    expect(popover).toBeInTheDocument();
    const html = document.body.innerHTML;
    expect(html).toContain("radix-popover-trigger-width");
    expect(html).not.toContain("w-[700px]");
  });
});