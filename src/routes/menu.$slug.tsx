import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Box, Clock3, MapPin, Search, UtensilsCrossed, X } from "lucide-react";
import { createElement, useMemo, useState } from "react";

import {
  fetchCategories,
  fetchEstablishmentBySlug,
  fetchMediaByEstablishment,
  fetchProducts,
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
  const establishmentQuery = useQuery({
    queryKey: ["public-establishment", slug],
    queryFn: () => fetchEstablishmentBySlug(slug),
  });
  const establishment = establishmentQuery.data;
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
        />
      )}
    </main>
  );
}

function ProductModal({
  product,
  media,
  urls,
  close,
}: {
  product: Product;
  media: NonNullable<ReturnType<typeof useQuery>["data"]>[] | any[];
  urls: Record<string, string>;
  close: () => void;
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
        </div>
      </article>
    </div>
  );
}
