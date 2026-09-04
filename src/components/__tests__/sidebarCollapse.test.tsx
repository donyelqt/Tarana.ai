import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SoundProvider } from "@/lib/sound/SoundProvider";
import Sidebar, { useSidebarCollapsed } from "../Sidebar";

jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

function Harness() {
  const { collapsed, contentClass } = useSidebarCollapsed();
  return (
    <div data-collapsed={String(collapsed)} data-offset={contentClass("md:pl-64")} />
  );
}

describe("useSidebarCollapsed", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to expanded with an md:pl-64 offset", () => {
    render(<Harness />);
    const el = document.querySelector("[data-collapsed]");
    expect(el?.getAttribute("data-collapsed")).toBe("false");
    expect(el?.getAttribute("data-offset")).toBe("md:pl-64");
  });

  it("restores a persisted collapsed rail", () => {
    window.localStorage.setItem("tarana-sidebar-collapsed", "1");
    render(<Harness />);
    const el = document.querySelector("[data-collapsed]");
    expect(el?.getAttribute("data-collapsed")).toBe("true");
    expect(el?.getAttribute("data-offset")).toBe("md:pl-20");
  });

  it("maps varied expanded offsets to their collapsed twins", () => {
    window.localStorage.setItem("tarana-sidebar-collapsed", "1");
    let contentClass: ((e: string) => string) | null = null;
    const Probe = () => {
      contentClass = useSidebarCollapsed().contentClass;
      return null;
    };
    render(<Probe />);
    expect(contentClass!("md:pl-72")).toBe("md:pl-20");
    expect(contentClass!("md:ml-64")).toBe("md:ml-20");
    expect(contentClass!("md:pl-64")).toBe("md:pl-20");
  });
});

describe("Sidebar collapse toggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function renderSidebar() {
    return render(
      <SoundProvider>
        <Sidebar />
      </SoundProvider>
    );
  }

  it("shows the full rail by default with a collapse button", () => {
    const { container } = renderSidebar();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    expect(container.querySelector("aside")?.className).not.toContain("md:w-20");
  });

  it("collapses to icons, persists, and expands back", () => {
    const { container } = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(window.localStorage.getItem("tarana-sidebar-collapsed")).toBe("1");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(container.querySelector("aside")?.className).toContain("md:w-20");
    expect(screen.getByTitle("Dashboard")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(window.localStorage.getItem("tarana-sidebar-collapsed")).toBe("0");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });
});