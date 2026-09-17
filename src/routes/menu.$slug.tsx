import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Box, Check, Clock3, Flame, MapPin, Minus, Plus, Search, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { createElement, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  fetchCategories,
  fetchEstablishmentBySlug,
  fetchMediaByEstablishment,
  fetchProducts,
  fetchOrderStatus,
  placeOrder,
  type Product,
} from "@/lib/api";
import { formatBRL } from "@/lib/format";
import { isOpenNow } from "@/lib/hours";
import { resolveStoredMediaUrl, signedUrlMap } from "@/lib/media";

export const Route = createFileRoute("/menu/$slug")({ component: PublicMenu });

function PublicMenu() {
  const { slug } = Route.useParams();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const previousStatus = useRef<string | null>(null);
  const establishmentQuery = useQuery({
    queryKey: ["public-establishment", slug],
    queryFn: () => fetchEstablishmentBySlug(slug),
  });
  const establishment = establishmentQuery.data;
  useEffect(() => {
    if (!establishment) return;
    setActiveOrderId(localStorage.getItem(`active-order:${establishment.id}`));
  }, [establishment]);
  const orderStatusQuery = useQuery({
    queryKey: ["customer-order-status", activeOrderId],
    enabled: !!activeOrderId,
    queryFn: () => fetchOrderStatus(activeOrderId!),
    refetchInterval: 5_000,
  });
  useEffect(() => {
    const order = orderStatusQuery.data;
    if (!order || previousStatus.current === order.status) return;
    if (previousStatus.current) {
      const messages: Record<string, string> = { preparing: "Seu pedido está em preparo!", ready: "Seu pedido está pronto!", completed: "Pedido entregue. Bom apetite!", cancelled: "O pedido foi cancelado." };
      const message = messages[order.status] ?? "O andamento do seu pedido foi atualizado.";
      toast.info(message);
      if ("Notification" in window && Notification.permission === "granted") new Notification("Cardápio 3D", { body: message });
    }
    previousStatus.current = order.status;
  }, [orderStatusQuery.data]);
  const logoQuery = useQuery({
    queryKey: ["establishment-logo", establishment?.logo_url],
    enabled: !!establishment?.logo_url,
    queryFn: () => resolveStoredMediaUrl(establishment!.logo_url),
  });
  const menuQuery = useQuery({
    queryKey: ["public-menu", establishment?.id],
    enabled: !!establishment,
    queryFn: async () => {
      const [categories, products, media] = await Promise.all([
        fetchCategories(establishment!.id, true),
        fetchProducts(establishment!.id, true),
        fetchMediaByEstablishment(establishment!.id),
      ]);
      const urls = await signedUrlMap(media.map((item) => item.storage_path));
      return { categories, products, media, urls };
    },
  });
  const filtered = useMemo(
    () =>
      (menuQuery.data?.products ?? []).filter(
        (p) =>
          (categoryId === "all" || p.category_id === categoryId) &&
          `${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [menuQuery.data, categoryId, search],
  );
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  if (establishmentQuery.isLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#100b08] text-amber-400">
        Carregando cardápio…
      </div>
    );
  if (!establishment)
    return (
      <div className="grid min-h-screen place-items-center bg-[#100b08] p-6 text-center text-stone-200">
        <div>
          <UtensilsCrossed className="mx-auto h-12 w-12 text-amber-400" />
          <h1 className="mt-4 text-2xl font-bold">Cardápio não encontrado</h1>
        </div>
      </div>
    );
  const data = menuQuery.data;
  const open = isOpenNow(establishment.opening_hours);
  const primary = String(
    (establishment.theme as { primary?: string } | null)?.primary ?? "#f59e0b",
  );
  return (
    <main
      className="min-h-screen bg-[#100b08] text-stone-100"
      style={{ "--brand": primary } as React.CSSProperties}
    >
      <header className="border-b border-white/10 bg-stone-950/80 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--brand)] text-stone-950">
              {logoQuery.data ? (
                <img
                  src={logoQuery.data}
                  alt={`Logo de ${establishment.name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UtensilsCrossed />
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[.25em] text-[var(--brand)]">
                Cardápio digital
              </p>
              <h1 className="mt-1 text-3xl font-bold">{establishment.name}</h1>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-400">
                {establishment.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {establishment.address}
                  </span>
                )}
                <span
                  className={`flex items-center gap-1 ${open ? "text-emerald-400" : "text-red-300"}`}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {open ? "Aberto agora" : "Fechado agora"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-4 py-6">
        {orderStatusQuery.data && <OrderTracker order={orderStatusQuery.data} clear={() => { if (establishment) localStorage.removeItem(`active-order:${establishment.id}`); setActiveOrderId(null); previousStatus.current = null; }} />}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no cardápio"
            className="field pl-12"
          />
        </div>
        <div className="mt-4 flex gap-2 overflow-auto pb-2">
          <button
            onClick={() => setCategoryId("all")}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${categoryId === "all" ? "bg-[var(--brand)] font-bold text-stone-950" : "bg-white/5 text-stone-300"}`}
          >
            Todos
          </button>
          {data?.categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${categoryId === c.id ? "bg-[var(--brand)] font-bold text-stone-950" : "bg-white/5 text-stone-300"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {!menuQuery.isLoading && filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-12 text-center text-stone-500">
              Nenhum produto disponível.
            </div>
          )}
          {filtered.map((product) => {
            const first = data?.media.find(
              (m) => m.product_id === product.id && m.media_type === "image",
            );
            const image = first ? data?.urls[first.storage_path] : null;
            return (
              <button
                key={product.id}
                onClick={() => setSelected(product)}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-1 hover:border-[var(--brand)]"
              >
                <div className="aspect-[16/10] bg-stone-900">
                  {image ? (
                    <img
                      src={image}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-stone-700">
                      <UtensilsCrossed className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-bold">{product.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-400">
                    {product.description || "Toque para ver detalhes."}
                  </p>
                  <strong className="mt-3 block text-[var(--brand)]">
                    {formatBRL(Number(product.price))}
                  </strong>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      {selected && data && (
        <ProductModal
          product={selected}
          media={data.media.filter((m) => m.product_id === selected.id)}
          urls={data.urls}
          close={() => setSelected(null)}
          add={() => {
            setCart((current) => ({ ...current, [selected.id]: (current[selected.id] ?? 0) + 1 }));
            setSelected(null);
            toast.success("Produto adicionado ao pedido.");
          }}
        />
      )}
      {cartCount > 0 && (
        <button onClick={() => setCheckoutOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-2xl bg-[var(--brand)] px-5 py-4 font-bold text-stone-950 shadow-2xl shadow-black/50">
          <ShoppingBag className="h-5 w-5" />Ver pedido <span className="rounded-full bg-stone-950 px-2 py-0.5 text-xs text-white">{cartCount}</span>
        </button>
      )}
      {checkoutOpen && data && (
        <CheckoutModal establishmentId={establishment.id} products={data.products} cart={cart} setCart={setCart} close={() => setCheckoutOpen(false)} onPlaced={(id) => { localStorage.setItem(`active-order:${establishment.id}`, id); previousStatus.current = "new"; setActiveOrderId(id); if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }} />
      )}
    </main>
  );
}

function ProductModal({
  product,
  media,
  urls,
  close,
  add,
}: {
  product: Product;
  media: NonNullable<ReturnType<typeof useQuery>["data"]>[] | any[];
  urls: Record<string, string>;
  close: () => void;
  add: () => void;
}) {
  const model = media.find((m) => m.media_type === "model_3d");
  const video = media.find((m) => m.media_type === "video_360");
  const image = media.find((m) => m.media_type === "image");
  const dimensions = [
    product.real_width_cm && `${product.real_width_cm} cm de largura`,
    product.real_height_cm && `${product.real_height_cm} cm de altura`,
    product.real_depth_cm && `${product.real_depth_cm} cm de profundidade`,
  ].filter(Boolean);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-end bg-black/75 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      onClick={close}
    >
      <article
        className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-3xl border border-white/10 bg-stone-950 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/10] bg-stone-900">
          {model && urls[model.storage_path] ? (
            createElement("model-viewer", {
              src: urls[model.storage_path],
              "camera-controls": true,
              "auto-rotate": true,
              ar: true,
              style: { width: "100%", height: "100%" },
              alt: `Modelo 3D de ${product.name}`,
            })
          ) : video && urls[video.storage_path] ? (
            <video src={urls[video.storage_path]} controls playsInline className="h-full w-full" />
          ) : image && urls[image.storage_path] ? (
            <img
              src={urls[image.storage_path]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-stone-600">
              <Box className="h-16 w-16" />
            </div>
          )}
          <button
            onClick={close}
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2"
          >
            <X />
          </button>
        </div>
        <div className="p-6">
          <h2 className="text-2xl font-bold">{product.name}</h2>
          <strong className="mt-2 block text-xl text-amber-400">
            {formatBRL(Number(product.price))}
          </strong>
          {product.description && (
            <p className="mt-4 leading-relaxed text-stone-300">{product.description}</p>
          )}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {dimensions.length > 0 && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="font-semibold">Dimensões reais</h3>
              <p className="mt-2 text-sm text-stone-400">{dimensions.join(" • ")}</p>
              <p className="mt-2 text-xs text-stone-600">
                Medidas informadas pelo estabelecimento. A visualização na tela pode variar conforme
                o dispositivo.
              </p>
            </div>
          )}
          <button onClick={add} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-bold text-stone-950"><ShoppingBag className="h-5 w-5" />Adicionar ao pedido</button>
        </div>
      </article>
    </div>
  );
}

function CheckoutModal({ establishmentId, products, cart, setCart, close, onPlaced }: { establishmentId: string; products: Product[]; cart: Record<string, number>; setCart: React.Dispatch<React.SetStateAction<Record<string, number>>>; close: () => void; onPlaced: (id: string) => void }) {
  const [sending, setSending] = useState(false);
  const items = products.filter(product => (cart[product.id] ?? 0) > 0);
  const total = items.reduce((sum, product) => sum + Number(product.price) * cart[product.id], 0);
  const change = (id: string, delta: number) => setCart(current => { const next = Math.max(0, (current[id] ?? 0) + delta); const updated = { ...current }; if (next) updated[id] = next; else delete updated[id]; return updated; });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSending(true);
    try {
      const orderId = await placeOrder({ establishmentId, customerName: String(data.get("customer_name")), tableNumber: String(data.get("table_number") || ""), notes: String(data.get("notes") || ""), items: items.map(product => ({ product_id: product.id, quantity: cart[product.id] })) });
      onPlaced(orderId);
      setCart({}); close(); toast.success("Pedido enviado para a cozinha!");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar o pedido."); }
    finally { setSending(false); }
  }
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-black/75 backdrop-blur-sm sm:place-items-center sm:p-5" onClick={close}><form onSubmit={submit} onClick={event => event.stopPropagation()} className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-t-3xl border border-white/10 bg-stone-950 p-6 sm:rounded-3xl"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-amber-400">Finalizar</p><h2 className="text-2xl font-bold">Seu pedido</h2></div><button type="button" onClick={close} className="rounded-full bg-white/10 p-2"><X /></button></div><div className="mt-5 space-y-3">{items.map(product => <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><strong>{product.name}</strong><p className="text-sm text-stone-500">{formatBRL(Number(product.price) * cart[product.id])}</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => change(product.id, -1)} className="rounded-lg bg-white/10 p-2"><Minus className="h-4 w-4" /></button><b>{cart[product.id]}</b><button type="button" onClick={() => change(product.id, 1)} className="rounded-lg bg-white/10 p-2"><Plus className="h-4 w-4" /></button></div></div>)}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2">Seu nome<input name="customer_name" required minLength={2} className="field mt-1" /></label><label>Mesa ou comanda<input name="table_number" className="field mt-1" placeholder="Ex.: Mesa 8" /></label><label>Observações<input name="notes" className="field mt-1" placeholder="Ex.: sem cebola" /></label></div><div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5"><div><p className="text-xs text-stone-500">Total</p><strong className="text-xl text-amber-400">{formatBRL(total)}</strong></div><button disabled={sending || items.length === 0} className="primary">{sending ? "Enviando…" : "Enviar para a cozinha"}</button></div></form></div>;
}

function OrderTracker({ order, clear }: { order: import("@/lib/api").CustomerOrderStatus; clear: () => void }) {
  const steps = [
    { key: "new", label: "Recebido", icon: Bell },
    { key: "preparing", label: "Em preparo", icon: Flame },
    { key: "ready", label: "Pronto", icon: Check },
  ];
  const index = steps.findIndex(step => step.key === order.status);
  const finished = order.status === "completed" || order.status === "cancelled";
  return <aside className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-amber-400">Pedido #{order.order_number}</p><h2 className="mt-1 text-lg font-bold">{order.status === "completed" ? "Pedido entregue" : order.status === "cancelled" ? "Pedido cancelado" : "Acompanhe seu pedido"}</h2></div>{finished && <button onClick={clear} className="text-sm text-stone-400 hover:text-white">Fechar</button>}</div>{!finished && <div className="mt-5 grid grid-cols-3 gap-2">{steps.map((step, stepIndex) => { const Icon = step.icon; const active = stepIndex <= index; return <div key={step.key} className={`rounded-xl border p-3 text-center text-xs ${active ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white/10 text-stone-600"}`}><Icon className="mx-auto mb-2 h-5 w-5" />{step.label}</div>; })}</div>}<p className="mt-3 text-xs text-stone-500">Esta tela atualiza automaticamente.</p></aside>;
}
