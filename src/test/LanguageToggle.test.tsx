import { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PageTransition } from "@/components/PageTransition";
vi.mock("@/contexts/LangContext", () => ({ useLang: () => {
  const location = useLocation();
  return { lang: location.pathname.startsWith("/en") ? "en" : "es", tr: {
    lang_toggle_label: "Language", lang_toggle_spanish: "Español", lang_toggle_english: "English",
  } };
} }));
beforeEach(() => { document.body.className = ""; });
it("shows the active SVG flag and preserves the route, query and entered form data", async () => {
  function Form() { const [value, setValue] = useState(""); return <input aria-label="Name" value={value} onChange={(e) => setValue(e.target.value)} />; }
  function Harness() {
    const location = useLocation();
    return <><LanguageToggle /><p>{location.pathname + location.search}</p><PageTransition><Form /></PageTransition></>;
  }
  render(<MemoryRouter initialEntries={["/es/register?source=demo"]}><Harness /></MemoryRouter>);
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Ana" } });
  const english = screen.getByRole("button", { name: "Idioma actual: Español. Cambiar a English." });
  expect(english.querySelector("svg")).toHaveAttribute("data-language", "es");
  expect(english.querySelector("svg")).not.toBeNull();
  expect(english.textContent).toBe("");
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Español" })).not.toBeInTheDocument();
  fireEvent.click(english);
  await waitFor(() => expect(screen.getByText("/en/register?source=demo")).toBeInTheDocument());
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Ana");
  const switched = screen.getByRole("button", { name: "Current language: English. Switch to Español." });
  expect(switched.querySelector("svg")).toHaveAttribute("data-language", "en");
  expect(screen.getAllByRole("button")).toHaveLength(1);
});
