import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Store, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useMyEstablishment, useSessionUser } from "@/hooks/useEstablishment";
import { createEstablishment } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Criar estabelecimento — Cardápio 3D" }] }),
  component: OnboardingPage,
});

const field =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-stone-600 focus:border-amber-400/70 focus:ring-4 focus:ring-amber-400/10";

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { userId } = useSessionUser();
  const establishmentQuery = useMyEstablishment(userId);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestedSlug = useMemo(() => makeSlug(name), [name]);

  useEffect(() => {
    if (establishmentQuery.data) navigate({ to: "/admin", replace: true });
  }, [establishmentQuery.data, navigate]);

  useEffect(() => {
    if (!slugEdited) setSlug(suggestedSlug);
  }, [slugEdited, suggestedSlug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const normalizedSlug = makeSlug(slug || name);
    if (normalizedSlug.length < 2) {
      setError("Informe um nome ou endereço do cardápio com pelo menos 2 caracteres.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await createEstablishment({
        name: name.trim(),
        slug: normalizedSlug,
        address: String(form.get("address") || "").trim() || null,
        phone: String(form.get("phone") || "").trim() || null,
        business_category: String(form.get("business_category") || "").trim() || null,
      });
      await establishmentQuery.refetch();
      navigate({ to: "/admin", replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.toLowerCase() : "";
      setError(
        message.includes("already") || message.includes("duplicate")
          ? "Esta conta já possui um estabelecimento ou esse endereço já está em uso."
          : "Não foi possível criar o estabelecimento. Verifique os dados e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (establishmentQuery.isLoading || establishmentQuery.data) {
    return <div className="grid min-h-screen place-items-center bg-[#100b08] text-amber-400">Carregando…</div>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#100b08] px-4 py-10 text-stone-100">
      <section className="w-full max-w-xl rounded-3xl border border-amber-400/20 bg-stone-950/80 p-6 shadow-2xl shadow-black/50 sm:p-9">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-stone-950">
            <UtensilsCrossed aria-hidden="true" className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">Conclua seu cadastro</h1>
          <p className="mt-2 text-sm text-stone-400">Crie o estabelecimento que ficará associado à sua conta.</p>
        </header>

        <form className="space-y-4" onSubmit={submit}>
          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          <label className="block space-y-2">
            <span className="text-sm font-medium">Nome do estabelecimento</span>
            <input className={field} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoFocus />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Endereço do cardápio</span>
            <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.06] focus-within:border-amber-400/70 focus-within:ring-4 focus-within:ring-amber-400/10">
              <span className="pl-4 text-sm text-stone-500">/menu/</span>
              <input className="h-12 min-w-0 flex-1 bg-transparent px-1 pr-4 text-sm text-white outline-none" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(makeSlug(event.target.value)); }} required minLength={2} placeholder="meu-restaurante" />
            </div>
          </label>
          <label className="block space-y-2"><span className="text-sm font-medium">Endereço físico</span><input className={field} name="address" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2"><span className="text-sm font-medium">Telefone</span><input className={field} name="phone" inputMode="tel" /></label>
            <label className="block space-y-2"><span className="text-sm font-medium">Categoria</span><input className={field} name="business_category" placeholder="Restaurante, pizzaria..." /></label>
          </div>
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-stone-950 transition hover:brightness-110 disabled:opacity-60">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Store className="h-5 w-5" />}
            {loading ? "Criando estabelecimento…" : "Criar estabelecimento"}
          </button>
        </form>
      </section>
    </main>
  );
}
