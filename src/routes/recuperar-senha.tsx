import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Cardápio 3D" },
      {
        name: "description",
        content: "Receba por e-mail um link para redefinir a senha do seu painel Cardápio 3D.",
      },
      { property: "og:title", content: "Recuperar senha — Cardápio 3D" },
      { property: "og:description", content: "Redefina a senha do painel do seu cardápio." },
    ],
  }),
  component: Recuperar,
});

function Recuperar() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (resetError) {
      setError("Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100b08] px-4 py-10 text-stone-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-stone-950/75 p-8">
        <h1 className="text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-2 text-sm text-stone-400">
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </p>
        {sent ? (
          <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
            Se este e-mail tiver uma conta, o link chegará em instantes.
          </p>
        ) : (
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
              <label className="text-sm font-medium" htmlFor="email">
                E-mail
              </label>
              <input
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10"
                id="email"
                name="email"
                required
                type="email"
              />
            </div>
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-stone-950 disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
              Enviar link
            </button>
          </form>
        )}
        <Link className="mt-6 inline-block text-sm font-semibold text-amber-400" to="/">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
