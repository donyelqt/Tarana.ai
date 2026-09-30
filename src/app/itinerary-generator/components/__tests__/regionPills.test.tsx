import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import ItineraryForm, { CITY_PILLS } from "../ItineraryForm";
import type { CityId } from "../../types";
import { REGION_MEMBERS, LUZON_MEMBERS } from "@/app/dashboard/utils";

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

/** Every city the backend will accept as `cityId`. */
const ROUTE_CITY_IDS: readonly CityId[] = [
  "baguio",
  "cebu",
  "manila",
  "davao",
  "boracay",
  "el_nido",
  "ph-wide",
  "world",
];

describe("Gala region pills", () => {
  describe("the alias contract", () => {
    it("shows the dashboard region row plus the pre-existing wide scopes", () => {
      // ph-wide and world were on the picker before this change and stay put;
      // only the city list narrows and gains the two region aliases.
      expect(CITY_PILLS.map((p) => p.label)).toEqual([
        "Baguio",
        "Manila",
        "Davao",
        "Visayas",
        "Luzon",
        "Philippines",
        "World",
      ]);
    });

    it("resolves every pill to a real backend city id, never to a region name", () => {
      // This is the invariant that keeps the API green: a region id sent as
      // cityId would be rejected by the route's zod enum with a 400.
      for (const pill of CITY_PILLS) {
        expect(ROUTE_CITY_IDS).toContain(pill.cityId);
        expect(pill.cityId).not.toBe(pill.label);
      }
    });

    it("carries no sublabel, so the tile stays one clean line of text", () => {
      // A sublabel was where the real destination used to be spelled out. It is
      // gone, so the heading is now the only place the alias can be caught
      // being an alias -- asserted in the picker behaviour block below.
      for (const pill of CITY_PILLS) {
        expect(pill).not.toHaveProperty("sublabel");
      }
    });

    it("resolves Visayas and Luzon inside the dashboard's own member sets", () => {
      // Visayas = boracay + cebu, Luzon = baguio + manila, as the dashboard
      // declares. Gala cannot import those constants (dashboard/utils pulls the
      // curated itinerary catalog into the client bundle), so this test is
      // what stops the two surfaces from drifting apart.
      const visayas = CITY_PILLS.find((p) => p.label === "Visayas");
      const luzon = CITY_PILLS.find((p) => p.label === "Luzon");

      expect([...REGION_MEMBERS].sort()).toEqual(["boracay", "cebu"]);
      expect([...LUZON_MEMBERS].sort()).toEqual(["baguio", "manila"]);
      expect(REGION_MEMBERS).toContain(visayas?.cityId);
      expect(LUZON_MEMBERS).toContain(luzon?.cityId);
    });
  });

  describe("picker behaviour", () => {
    it.each([
      ["Visayas", "boracay"],
      ["Luzon", "manila"],
      ["Davao", "davao"],
    ])("selecting %s sends the real city id %s, not the label", (label, expected) => {
      const setSelectedCity = jest.fn();
      render(
        <ToastProvider>
          <ItineraryForm {...baseProps} setSelectedCity={setSelectedCity} />
        </ToastProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`, "i") }));
      expect(setSelectedCity).toHaveBeenCalledWith(expected);
    });

    it("presses only the pill the user picked when two pills share a city", () => {
      render(
        <ToastProvider>
          <ItineraryForm {...baseProps} selectedCity="manila" />
        </ToastProvider>
      );

      // Manila and Luzon both resolve to Metro Manila; deriving the pressed
      // state from the city id would light up both tiles at once.
      const luzon = screen.getByRole("button", { name: /^Luzon/i });
      const manila = screen.getByRole("button", { name: /^Manila/i });
      expect(luzon).toHaveAttribute("aria-pressed", "false");
      expect(manila).toHaveAttribute("aria-pressed", "true");
    });
    it("names the real destination in the heading, not the pill alias", () => {
      // Tiles lost their sublabel, so the heading is the last place a user can
      // learn that "Visayas" plans Boracay. It must not echo the alias.
      // Controlled harness: the heading reads the selectedCity prop, so the
      // click has to propagate the way the real page wires it.
      function Harness() {
        const [city, setCity] = React.useState<CityId>("baguio");
        return (
          <ToastProvider>
            <ItineraryForm {...baseProps} selectedCity={city} setSelectedCity={setCity} />
          </ToastProvider>
        );
      }
      render(<Harness />);

      fireEvent.click(screen.getByRole("button", { name: /^Visayas/i }));
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Plan Your Boracay Adventure");
    });
  });
});