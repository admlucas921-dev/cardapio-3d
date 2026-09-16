import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, UtensilsCrossed } from "lucide-react";
import { useState, type FormEvent } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Cardápio 3D" },
      {
        name: "description",
        content: "Cadastre seu restaurante e publique um cardápio digital com visualização 3D.",
      },
      { property: "og:title", content: "Criar conta — Cardápio 3D" },
      {
        property: "og:description",
        content: "Cadastre seu restaurante no Cardápio 3D em poucos minutos.",
      },
    ],
  }),
  component: Cadastro,
});

const field =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-stone-600 focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10";

function Cadastro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setError(null);
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: String(form.get("email") ?? ""),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          establishment_name: String(form.get("name") ?? ""),
          address: String(form.get("address") ?? ""),
          phone: String(form.get("phone") ?? ""),
          business_category: String(form.get("business_category") ?? ""),
        },
      },
    });
    setLoading(false);
    if (signUpError) {
      const m = signUpError.message.toLowerCase();
      setError(
        m.includes("already registered") || m.includes("already been registered")
          ? "Este e-mail já possui uma conta. Faça login."
          : "Não foi possível criar a conta. Tente novamente.",
      );
      return;
    }
    if (data.session) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100b08] px-4 py-10 text-stone-100">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-stone-950/75 p-6 shadow-2xl shadow-black/50 sm:p-9">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-stone-950">
            <UtensilsCrossed aria-hidden="true" className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">Criar conta do estabelecimento</h1>
          <p className="mt-2 text-sm text-stone-400">
            Seus dados são usados para montar o cardápio público.
          </p>
        </header>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
              Conta criada. Enviamos um e-mail de confirmação — clique no link e depois faça login
              para concluir a configuração do seu cardápio.
            </p>
            <Link className="text-sm font-semibold text-amber-400" to="/">
              Ir para o login
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {error}
              </p>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Nome do estabelecimento
              </label>
              <input className={field} id="name" name="name" required minLength={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  E-mail
                </label>
                <input
                  className={field}
                  id="email"
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Senha
                </label>
                <input
                  className={field}
                  id="password"
                  name="password"
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="address">
                Endereço
              </label>
              <input className={field} id="address" name="address" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="phone">
                  Telefone
                </label>
                <input className={field} id="phone" name="phone" inputMode="tel" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="business_category">
                  Categoria do negócio
                </label>
                <input
                  className={field}
                  id="business_category"
                  name="business_category"
                  placeholder="Restaurante, pizzaria..."
                />
              </div>
            </div>

            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-stone-950 transition hover:brightness-110 disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
              Criar conta
            </button>

            <p className="text-center text-sm text-stone-500">
              Já tem conta?{" "}
              <Link className="font-semibold text-amber-400" to="/">
                Entrar
              </Link>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
