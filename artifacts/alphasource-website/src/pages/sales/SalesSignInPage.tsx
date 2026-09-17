import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import DashboardBrand from "@/components/DashboardBrand";
import { useAuth } from "@/context/AuthContext";

export default function SalesSignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loginSales, salesLoginLoading, salesLoginError } = useAuth();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await loginSales(email, password);
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] px-4 py-10" style={{ fontFamily: "'Raleway', sans-serif" }}>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-2xl border border-[#0A1547]/[0.07] bg-white p-6 shadow-[0_24px_70px_rgba(10,21,71,0.10)] sm:p-8">
          <DashboardBrand mode="light" variant="full" />
          <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#A380F6]">
            <LockKeyhole className="h-3.5 w-3.5" /> Sales workspace
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#0A1547]">Sign in to continue</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#0A1547]/50">Use the Google Workspace email assigned to your sales account.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-xs font-black text-[#0A1547]">
              Work email
              <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#0A1547]/10 px-3.5 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" placeholder="name@alphasourceai.com" />
            </label>
            <label className="block text-xs font-black text-[#0A1547]">
              Password
              <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#0A1547]/10 px-3.5 text-sm font-semibold outline-none transition focus:border-[#A380F6] focus:ring-4 focus:ring-[#A380F6]/10" />
            </label>
            {salesLoginError ? <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">{salesLoginError}</p> : null}
            <button type="submit" disabled={salesLoginLoading} className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#0A1547] text-sm font-black text-white transition hover:bg-[#111f5f] disabled:cursor-not-allowed disabled:opacity-55">
              {salesLoginLoading ? "Verifying access…" : "Sign in"}
              {!salesLoginLoading ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
