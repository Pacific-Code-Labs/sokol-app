import { AppShell } from "@pacific-code-labs/sokol-design-system";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { ProductLayout } from "@/components/ProductLayout";
import { useState } from "react";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { userId: "user", username: "jc_charpa" }, profile: { firstName: "Juan", lastName: "Campos", username: "jc_charpa" }, loading: false, signOut: vi.fn() }) }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: new Proxy({}, { get: (_, key) => String(key) }) }) }));
vi.mock("@/hooks/useMe", () => ({ useMe: () => ({ tier: "pro" }) }));
vi.mock("@/hooks/useRbac", () => ({ usePermissions: () => ({ isReady: true, isAdmin: true, isOwner: true, can: () => true }) }));
vi.mock("@/hooks/useRealtimeEvents", () => ({ useRealtimeEvents: () => {} }));
vi.mock("@/components/LanguageToggle", () => ({ LanguageToggle: () => <Link to="/en/projects">English</Link> }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/services/branding.service", () => ({ getBrandingVM: () => ({ companyName: "Sokol" }) }));
vi.mock("@/components/GlobalAssistant", () => ({ GlobalAssistant: function Assistant() { const [text, setText] = useState(""); return <input aria-label="conversation" value={text} onChange={e => setText(e.target.value)} />; } }));

it("preserves sidebar, header and assistant across sections and language changes", () => {
  HTMLElement.prototype.scrollTo = vi.fn();
  render(<MemoryRouter initialEntries={["/es/dashboard"]}><Routes><Route path="/:lang" element={<ProductLayout />}><Route path="dashboard" element={<Link to="/es/projects">Projects</Link>} /><Route path="projects" element={<p>Project cards</p>} /></Route></Routes></MemoryRouter>);
  const sidebar = document.querySelector("aside");
  const header = document.querySelector("header");
  fireEvent.change(screen.getByLabelText("conversation"), { target: { value: "NFPA conversation" } });
  const toggle = screen.getByRole("button", { name: "nav_hide_sidebar" });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(toggle.querySelector("svg")).toHaveClass("lucide-chevron-left");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle.querySelector("svg")).toHaveClass("lucide-chevron-right");
  expect(sidebar?.parentElement).toHaveAttribute("aria-hidden", "true");
  expect(sidebar?.parentElement?.inert).toBe(true);
  expect(sidebar?.parentElement).toHaveClass("w-0", "z-50");
  fireEvent.click(screen.getByRole("link", { name: "Projects" }));
  expect(screen.getByText("Project cards")).toBeInTheDocument();
  expect(document.querySelector("aside")).toBe(sidebar);
  expect(document.querySelector("header")).toBe(header);
  expect(screen.getAllByRole("button", { name: "nav_show_sidebar" })).toHaveLength(2);
  expect(screen.queryByText("nav_roles")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "English" }));
  expect(document.querySelector("aside")).toBe(sidebar);
  expect(screen.getByLabelText("conversation")).toHaveValue("NFPA conversation");
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.querySelector("#page-content")).toHaveClass("overflow-y-auto");
});


it("restores the saved hidden sidebar with the matching button state", () => {
  const shell = <AppShell location="/projects" onNavigate={() => {}} brand={() => "Sokol"} topbar={() => <header />} navigationStyle="compact" sidebarStorageKey="sidebar-reload-test" labels={{expand:"Show",collapse:"Hide",close:"Close"}}><p>Project</p></AppShell>;
  localStorage.removeItem("sidebar-reload-test");
  const view = render(shell);
  fireEvent.click(screen.getByRole("button", {name:"Hide"}));
  expect(localStorage.getItem("sidebar-reload-test")).toBe("true");
  view.unmount();
  const restored = render(shell);
  const button = screen.getByRole("button", {name:"Show"});
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(button.querySelector("svg")).toHaveClass("lucide-chevron-right");
  fireEvent.click(button);
  expect(button).toHaveAccessibleName("Hide");
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(button.querySelector("svg")).toHaveClass("lucide-chevron-left");
  expect(localStorage.getItem("sidebar-reload-test")).toBe("false");
  restored.unmount();
  localStorage.removeItem("sidebar-reload-test");
});
