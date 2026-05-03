import { useState } from "react";
import { loginEmail, loginGoogle, registerEmail } from "../lib/firebase";
import { Logo } from "./Logo";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

export function AuthPages({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "login") await loginEmail(email, password);
      else await registerEmail(name, email, password);
      onAuth();
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }
  async function handleGoogle() {
    setErr(""); setBusy(true);
    try { await loginGoogle(); onAuth(); }
    catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex mb-3">
            <Logo size={56} />
          </div>
          <h1 className="text-2xl">Chester AI Studio</h1>
          <p className="text-sm text-gray-500">{mode === "login" ? "Selamat datang kembali" : "Buat akun baru"}</p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full border border-gray-300 rounded-lg py-2.5 flex items-center justify-center gap-2 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <GoogleIcon /> Lanjutkan dengan Google
        </button>

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">atau</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "register" && (
            <input type="text" required placeholder="Nama lengkap" value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 border rounded-lg outline-none focus:border-blue-500" />
          )}
          <input type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2.5 border rounded-lg outline-none focus:border-blue-500" />
          <input type="password" required minLength={6} placeholder="Password (min. 6)" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2.5 border rounded-lg outline-none focus:border-blue-500" />
          {err && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{err}</div>}
          <button type="submit" disabled={busy}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy ? "Memproses..." : mode === "login" ? "Login" : "Daftar"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
            className="text-blue-600 hover:underline">
            {mode === "login" ? "Daftar" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
