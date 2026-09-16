import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, UtensilsCrossed } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Cardápio 3D" },
      {
        name: "description",
        content:
          "Acesse o painel do Cardápio 3D para gerenciar categorias, produtos e mídias em 3D do seu restaurante.",
      },
      { property: "og:title", content: "Entrar — Cardápio 3D" },
      {
        property: "og:description",
        content: "Painel de gestão do cardápio digital com visualização 3D.",
      },
    ],
  }),
  component: Index,
});

const REMEMBER_KEY = "cardapio3d:remember-email";

function traduzErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  return "Não foi possível entrar. Tente novamente.";
}

function Index() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(traduzErro(signInError.message));
      return;
    }
    if (remember) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
    navigate({ to: "/admin", replace: true });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#100b08] px-4 py-10 text-stone-100">
      <div className="absolute -left-36 -top-36 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-orange-700/15 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-stone-950/75 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-9">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-stone-950 shadow-lg shadow-orange-950/40">
            <UtensilsCrossed aria-hidden="true" className="h-8 w-8" strokeWidth={2.2} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-amber-400">
            Cardápio 3D
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo</h1>
          <p className="mt-2 text-sm text-stone-400">Entre para gerenciar seu cardápio.</p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-200" htmlFor="email">
              E-mail
            </label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500"
              />
              <input
                autoComplete="email"
                className="h-13 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-stone-600 focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10"
                id="email"
                name="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                type="email"
                value={email}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-stone-200" htmlFor="password">
                Senha
              </label>
              <Link
                to="/recuperar-senha"
                className="text-xs font-medium text-amber-400 transition hover:text-amber-300"
              >
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <LockKeyhole
                aria-hidden="true"
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500"
              />
              <input
                autoComplete="current-password"
                className="h-13 w-full rounded-xl border border-white/10 bg-white/[0.06] pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-stone-600 focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10"
                id="password"
                name="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 transition hover:text-stone-200"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <Eye aria-hidden="true" className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-stone-400">
            <input
              checked={remember}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-amber-500"
              name="remember"
              onChange={(e) => setRemember(e.target.checked)}
              type="checkbox"
            />
            Lembrar de mim
          </label>

          <button
            className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-stone-950 shadow-lg shadow-orange-950/30 transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : null}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-stone-500">
          Ainda não tem uma conta?{" "}
          <Link className="font-semibold text-amber-400 hover:text-amber-300" to="/cadastro">
            Criar conta
          </Link>
        </p>
      </section>
    </main>
  );
}
