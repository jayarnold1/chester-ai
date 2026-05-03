import { useEffect, useState } from "react";
import { AuthPages } from "./components/AuthPages";
import { ChesterStudio } from "./components/ChesterStudio";
import { SearchSimulator } from "./components/SearchSimulator";
import { logout, watchAuth, type User } from "./lib/firebase";
import { Logo } from "./components/Logo";

type Tab = "studio" | "search";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("studio");

  useEffect(() => watchAuth((u) => { setUser(u); setReady(true); }), []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return <AuthPages onAuth={() => { /* listener will pick up */ }} />;

  return (
    <div className="min-h-screen bg-gray-100 p-3 md:p-5">
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="flex items-center justify-between bg-white rounded-2xl shadow p-3">
          <div className="flex items-center gap-3">
            <Logo size={40} withWordmark />
            <div className="hidden md:block text-xs text-gray-500 border-l pl-3">Selamat Datang : {user.displayName || user.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button onClick={() => setTab("studio")} className={`px-3 py-1 rounded ${tab === "studio" ? "bg-white shadow" : "text-gray-600"}`}>Studio</button>
              <button onClick={() => setTab("search")} className={`px-3 py-1 rounded ${tab === "search" ? "bg-white shadow" : "text-gray-600"}`}>AI Search</button>
            </div>
            <button onClick={() => logout()} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Logout</button>
          </div>
        </div>

        {tab === "studio" ? <ChesterStudio /> : <SearchSimulator />}

        <div className="text-center text-xs text-gray-400 py-3">
          Chester AI Studio Pro by : Evenly · Rolan · Jay
        </div>
      </div>
    </div>
  );
}
