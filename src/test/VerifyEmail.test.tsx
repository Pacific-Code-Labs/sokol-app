import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VerifyEmail from "@/pages/VerifyEmail";
import { t } from "@/lib/i18n";
const auth = vi.hoisted(()=>({confirmSignUp:vi.fn(),signIn:vi.fn(),resendCode:vi.fn()}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>auth}));
vi.mock("@/contexts/LangContext",()=>({useLang:()=>({lang:"es",tr:t.es})}));
vi.mock("@/components/auth/AuthShell",()=>({AuthShell:({children}:{children:React.ReactNode})=><div>{children}</div>}));
const page = () => render(<MemoryRouter initialEntries={["/es/verify-email"]}><Routes>
  <Route path="/es/verify-email" element={<VerifyEmail />} />
  <Route path="/es/login" element={<p>Login destination</p>} />
  <Route path="/es/dashboard" element={<p>Dashboard destination</p>} />
</Routes></MemoryRouter>);
beforeEach(()=> {
  sessionStorage.clear();
  sessionStorage.setItem("verificationEmail","test@example.invalid");
  auth.confirmSignUp.mockReset().mockResolvedValue(undefined);
  auth.signIn.mockReset().mockResolvedValue({needsConfirmation:false});
  auth.resendCode.mockReset();
});
const paste=(value:string)=>fireEvent.paste(screen.getAllByRole("textbox")[0],{clipboardData:{getData:()=>value}});

it("centers the code cells and automatically verifies the newly pasted code",async()=>{
  page();
  const group=screen.getByRole("group",{name:t.es.auth_verify_code});
  expect(group.parentElement).toHaveClass("items-center","text-center");
  expect(group).toHaveClass("justify-center");
  paste("123 456\n");
  await screen.findByText("Login destination");
  expect(auth.confirmSignUp).toHaveBeenCalledExactlyOnceWith("test@example.invalid","123456");
  expect(sessionStorage.getItem("verificationEmail")).toBeNull();
});

it("automatically verifies the sixth typed digit and signs in with the stashed password",async()=>{
  sessionStorage.setItem("verificationPassword","test-password");
  page();
  const cells=screen.getAllByRole("textbox");
  "654321".split("").forEach((digit,index)=>fireEvent.change(cells[index],{target:{value:digit}}));
  await screen.findByText("Dashboard destination");
  expect(auth.confirmSignUp).toHaveBeenCalledExactlyOnceWith("test@example.invalid","654321");
  expect(auth.signIn).toHaveBeenCalledExactlyOnceWith("test@example.invalid","test-password");
});

it("prevents duplicate submissions and retries a corrected pasted code after a real mismatch",async()=>{
  let fail!:(error:Error)=>void;
  auth.confirmSignUp.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;}));
  page();
  paste("111111");
  paste("111111");
  expect(auth.confirmSignUp).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button",{name:t.es.auth_verify_submitting})).toBeDisabled();
  fail(Object.assign(new Error("Invalid code"),{name:"CodeMismatchException"}));
  expect(await screen.findByRole("alert")).toHaveTextContent(t.es.auth_verify_incorrect_code);
  paste("222222");
  await screen.findByText("Login destination");
  expect(auth.confirmSignUp).toHaveBeenCalledTimes(2);
  expect(auth.confirmSignUp).toHaveBeenLastCalledWith("test@example.invalid","222222");
});
