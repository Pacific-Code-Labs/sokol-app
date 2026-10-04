import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
});

it("tracks the real target and adjusts when scrolling changes its position", async () => {
  let top = 120;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return this.dataset.tour ? { left: 60, top, width: 240, height: 80, right: 300, bottom: top + 80 } as DOMRect : {} as DOMRect;
  });
  const scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  const view = render(<><button data-tour="action">Action</button><TutorialSpotlight selector='[data-tour="action"]' label="Guide"><button>Next</button></TutorialSpotlight></>);
  await waitFor(() => expect(document.querySelector("[data-tutorial-spotlight]")).toHaveStyle({ top: "112px", left: "52px", width: "256px", height: "96px" }));
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", inline: "nearest", behavior: "instant" });
  top = 200;
  fireEvent.scroll(document);
  await waitFor(() => expect(document.querySelector("[data-tutorial-spotlight]")).toHaveStyle({ top: "192px" }));
  view.unmount();
  expect(document.querySelector("[data-tutorial-spotlight]")).toBeNull();
});

it("keeps the guide inside a mobile viewport and keyboard focus on tour controls", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return this.dataset.tour ? { left: 16, top: 80, width: 358, height: 100, right: 374, bottom: 180 } as DOMRect : {} as DOMRect;
  });
  render(<><div data-tour="action" /><TutorialSpotlight selector='[data-tour="action"]' label="Guide"><button>Previous</button><button>Next</button></TutorialSpotlight></>);
  const guide = screen.getByRole("region", { name: "Guide" });
  await waitFor(() => expect(guide).toHaveStyle({ left: "16px", width: "358px", top: "204px" }));
  const next = screen.getByRole("button", { name: "Next" });
  next.focus();
  fireEvent.keyDown(next, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Previous" })).toHaveFocus();
});

it("waits for a target rendered after navigation and removes the old spotlight", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return this.dataset.tour ? { left: 20, top: 70, width: 100, height: 60, right: 120, bottom: 130 } as DOMRect : {} as DOMRect;
  });
  const view = render(<TutorialSpotlight selector='[data-tour="late"]' label="Guide"><button>Next</button></TutorialSpotlight>);
  expect(document.querySelector("[data-tutorial-spotlight]")).toBeNull();
  view.rerender(<><div data-tour="late" /><TutorialSpotlight selector='[data-tour="late"]' label="Guide"><button>Next</button></TutorialSpotlight></>);
  await waitFor(() => expect(document.querySelector("[data-tutorial-spotlight]")).not.toBeNull());
  view.rerender(<TutorialSpotlight selector={null} label="Guide"><button>Next</button></TutorialSpotlight>);
  await waitFor(() => expect(document.querySelector("[data-tutorial-spotlight]")).toBeNull());
  expect(screen.getByRole("button", { name: "Next" })).toBeVisible();
});
