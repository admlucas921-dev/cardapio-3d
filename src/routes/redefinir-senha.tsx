import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — Cardápio 3D" },
      { name: "description", content: "Crie uma nova senha para acessar o painel Cardápio 3D." },
      { property: "og:title", content: "Definir nova senha — Cardápio 3D" },
      { property: "og:description", content: "Crie uma nova senha de acesso ao painel." },
    ],
  }),
  component: Redefinir,
});

function Redefinir() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== String(form.get("confirm") ?? "")) {
      setError("As senhas não conferem.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Link expirado ou inválido. Solicite um novo e-mail de recuperação.");
      return;
    }
    navigate({ to: "/admin", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100b08] px-4 py-10 text-stone-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-stone-950/75 p-8">
        <h1 className="text-2xl font-semibold">Definir nova senha</h1>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Nova senha
            </label>
            <input
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none focus:border-amber-400/70"
              id="password"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirm">
              Confirmar senha
            </label>
            <input
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none focus:border-amber-400/70"
              id="confirm"
              minLength={8}
              name="confirm"
              required
              type="password"
            />
          </div>
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-stone-950 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
            Salvar senha
          </button>
        </form>
      </section>
    </main>
  );
}
