import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import ItineraryForm, { CITY_GROUPS, CITY_OPTIONS } from "../ItineraryForm";

window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLElement.prototype.hasPointerCapture = jest.fn();
window.HTMLElement.prototype.setPointerCapture = jest.fn();
window.HTMLElement.prototype.releasePointerCapture = jest.fn();
window.ResizeObserver = jest.fn(() => ({ observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }));

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

const memberIds = (label: string) =>
  CITY_GROUPS.find((g) => g.label === label)?.cities.map((c) => c.id) ?? [];

describe("Gala destination groups", () => {
  describe("grouping invariants (the display-only contract)", () => {
    it("files every city option in exactly one group, so no destination tile is lost or duplicated", () => {
      const all = CITY_GROUPS.flatMap((g) => g.cities.map((c) => c.id));
      expect([...all].sort()).toEqual([...CITY_OPTIONS.map((c) => c.id)].sort());
      expect(all).toHaveLength(new Set(all).size);
    });

    it("keeps Luzon = baguio+manila and Visayas = cebu+boracay, matching the dashboard region tabs", () => {
      // Geographic identity must agree across surfaces; a swapped filter would
      // file Baguio as Visayan and silently change what a tile promises.
      expect(memberIds("Luzon").sort()).toEqual(["baguio", "manila"]);
      expect(memberIds("Visayas").sort()).toEqual(["boracay", "cebu"]);
    });

    it("never lets a group label masquerade as a selectable city id", () => {
      // A group label reaching setSelectedCity would hit the route's zod enum
      // and 400. Groups are display-only, so no label may be a member id.
      const ids: string[] = CITY_GROUPS.flatMap((g) => g.cities.map((c) => c.id));
      for (const group of CITY_GROUPS) {
        expect(ids).not.toContain(group.label.toLowerCase().replace(/\s+/g, "-"));
      }
    });
  });

  describe("picker behaviour", () => {
    it("selecting a grouped destination sets its real single city id", () => {
      const setSelectedCity = jest.fn();
      render(
        <ToastProvider>
          <ItineraryForm {...baseProps} selectedCity="baguio" setSelectedCity={setSelectedCity} />
        </ToastProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /boracay/i }));
      expect(setSelectedCity).toHaveBeenCalledWith("boracay");
    });

    it("renders group headings as labels, not as extra destination buttons", () => {
      render(
        <ToastProvider>
          <ItineraryForm {...baseProps} />
        </ToastProvider>
      );

      expect(screen.getByText("Luzon")).toBeInTheDocument();
      expect(screen.getByText("Visayas")).toBeInTheDocument();
      // A group heading must never be clickable as a destination.
      expect(screen.queryByRole("button", { name: /^visayas$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^luzon$/i })).not.toBeInTheDocument();
    });

    it("marks only the current city tile as pressed", () => {
      render(
        <ToastProvider>
          <ItineraryForm {...baseProps} selectedCity="cebu" />
        </ToastProvider>
      );

      expect(screen.getByRole("button", { name: /cebu/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /baguio/i })).toHaveAttribute("aria-pressed", "false");
    });
  });
});