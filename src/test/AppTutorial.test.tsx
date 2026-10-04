import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppTutorial, tutorialStorageKey } from "@/components/AppTutorial";
import { t } from "@/lib/i18n";
const language = vi.hoisted(() => ({ value: "es" as "es" | "en" }));
vi.mock("@/contexts/LangContext", () => ({useLang:()=>({lang:language.value,tr:t[language.value]})}));
function Location() { return <p data-testid="location">{useLocation().pathname}</p>; }
const tour = (props={}) => <MemoryRouter initialEntries={["/es/dashboard"]}><AppTutorial userId="new-user" ready dashboard projects evaluator {...props} /><Location /></MemoryRouter>;
beforeEach(()=> {localStorage.clear(); language.value="es";});

it("offers a first-visit tour, visits real pages and persists progress across reloads and language changes", () => {
  const view = render(tour());
  expect(screen.getByRole("dialog")).toHaveTextContent(t.es.tour_welcome_title);
  fireEvent.click(screen.getByRole("button", {name:t.es.tour_start}));
  fireEvent.click(screen.getByRole("button", {name:t.es.tour_next}));
  expect(screen.getByTestId("location")).toHaveTextContent("/es/projects");
  expect(screen.getByText(t.es.tour_projects_title)).toBeInTheDocument();
  view.unmount();
  language.value="en";
  render(tour());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText(t.en.tour_projects_title)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:t.en.tour_visit}));
  expect(screen.getByTestId("location")).toHaveTextContent("/en/projects");
});

it("allows dismissal and replay, keeping another user's first visit independent", () => {
  const view=render(tour());
  fireEvent.click(screen.getByRole("button", {name:t.es.tour_later}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.unmount();
  const restored=render(tour());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:t.es.tour_replay}));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  restored.unmount();
  render(tour({userId:"another-user"}));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("skips unavailable capabilities and records completion without submitting any work", () => {
  render(tour({projects:false,evaluator:false}));
  fireEvent.click(screen.getByRole("button", {name:t.es.tour_start}));
  fireEvent.click(screen.getByRole("button", {name:t.es.tour_next}));
  expect(screen.getByText(t.es.tour_assistant_title)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:t.es.tour_next}));
  expect(screen.getByTestId("location")).toHaveTextContent("/es/dashboard/profile");
  fireEvent.click(screen.getByRole("button", {name:t.es.tour_finish}));
  expect(JSON.parse(localStorage.getItem(tutorialStorageKey("new-user"))!).status).toBe("complete");
  expect(screen.getByTestId("location")).toHaveTextContent("/es/dashboard/profile");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

it("does not interrupt a deep link or begin before permissions load", () => {
  const view = render(<MemoryRouter initialEntries={["/es/projects/project-one"]}><AppTutorial userId="new-user" ready dashboard projects evaluator /></MemoryRouter>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.unmount();
  render(tour({ready:false}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("teaches assistant requests and their outcomes in each work section", () => {
  render(tour());
  fireEvent.click(screen.getByRole("button", { name: t.es.tour_start }));
  for (const section of ["projects", "evaluator", "diagram", "assistant"]) {
    fireEvent.click(screen.getByRole("button", { name: t.es.tour_next }));
    expect(screen.getByText(t.es[`tour_${section}_example`])).toBeInTheDocument();
    expect(screen.getByText(t.es[`tour_${section}_outcome`])).toBeInTheDocument();
  }
});
