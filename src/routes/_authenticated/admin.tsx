import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Eye,
  FolderOpen,
  LayoutDashboard,
  ChefHat,
  LogOut,
  Palette,
  Plus,
  Save,
  Trash2,
  Upload,
  UtensilsCrossed,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useMyEstablishment, useSessionUser } from "@/hooks/useEstablishment";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteMedia,
  deleteProduct,
  fetchCategories,
  fetchMediaByEstablishment,
  fetchProducts,
  insertMedia,
  updateCategory,
  updateEstablishment,
  updateProduct,
  type Category,
  type Product,
  type ProductMedia,
} from "@/lib/api";
import { formatBRL } from "@/lib/format";
import { normalizeHours, WEEK_DAYS, type OpeningHours } from "@/lib/hours";
import {
  MEDIA_RULES,
  buildStoragePath,
  removeFromBucket,
  uploadToBucket,
  validateMediaFile,
  type MediaKind,
} from "@/lib/media";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

type Tab = "dashboard" | "categories" | "products" | "settings";

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, email } = useSessionUser();
  const establishmentQuery = useMyEstablishment(userId);
  const establishment = establishmentQuery.data;
  const [tab, setTab] = useState<Tab>("dashboard");
  const [busy, setBusy] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["categories", establishment?.id],
    queryFn: () => fetchCategories(establishment!.id),
    enabled: !!establishment,
  });
  const productsQuery = useQuery({
    queryKey: ["products", establishment?.id],
    queryFn: () => fetchProducts(establishment!.id),
    enabled: !!establishment,
  });
  const mediaQuery = useQuery({
    queryKey: ["media", establishment?.id],
    queryFn: () => fetchMediaByEstablishment(establishment!.id),
    enabled: !!establishment,
  });

  const refresh = () => queryClient.invalidateQueries();
  const run = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await work();
      await refresh();
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  if (establishmentQuery.isLoading) return <Loading />;
  if (!establishment) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#100b08] p-6 text-stone-100">
        <div className="max-w-lg rounded-3xl border border-amber-400/20 bg-stone-950 p-8 text-center">
          <UtensilsCrossed className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-4 text-2xl font-bold">Conclua seu cadastro</h1>
          <p className="mt-2 text-stone-400">
            Sua conta ainda não possui um estabelecimento associado.
          </p>
          <Link
            to="/onboarding"
            className="mt-6 inline-flex rounded-xl bg-amber-400 px-5 py-3 font-bold text-stone-950"
          >
            Criar estabelecimento
          </Link>
        </div>
      </main>
    );
  }

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const media = mediaQuery.data ?? [];
  const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
    { id: "categories", label: "Categorias", icon: FolderOpen },
    { id: "products", label: "Produtos e 3D", icon: Boxes },
    { id: "settings", label: "Aparência e dados", icon: Palette },
  ];

  return (
    <main className="min-h-screen bg-[#100b08] text-stone-100 md:flex">
      <aside className="border-b border-white/10 bg-stone-950/90 p-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-stone-950">
            <UtensilsCrossed />
          </span>
          <div>
            <strong>{establishment.name}</strong>
            <p className="text-xs text-stone-500">Cardápio 3D</p>
          </div>
        </div>
        <nav className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-1">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${tab === id ? "bg-amber-400 font-bold text-stone-950" : "text-stone-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm">
          <a
            href={`/menu/${establishment.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-amber-400"
          >
            <Eye className="h-4 w-4" />
            Ver cardápio público
          </a>
          <Link to="/cozinha" className="flex items-center gap-2 text-amber-400">
            <ChefHat className="h-4 w-4" />
            Abrir painel da cozinha
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="flex items-center gap-2 text-stone-500 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair ({email})
          </button>
        </div>
      </aside>

      <section className="mx-auto w-full max-w-6xl p-5 md:p-10">
        {tab === "dashboard" && (
          <Dashboard
            categories={categories}
            products={products}
            mediaCount={media.length}
            slug={establishment.slug}
          />
        )}
        {tab === "categories" && (
          <CategoriesPanel
            establishmentId={establishment.id}
            categories={categories}
            busy={busy}
            run={run}
          />
        )}
        {tab === "products" && (
          <ProductsPanel
            establishmentId={establishment.id}
            categories={categories}
            products={products}
            media={media}
            busy={busy}
            run={run}
          />
        )}
        {tab === "settings" && (
          <SettingsPanel establishment={establishment} busy={busy} run={run} />
        )}
      </section>
    </main>
  );
}

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#100b08] text-amber-400">
      Carregando painel…
    </div>
  );
}

function Dashboard({
  categories,
  products,
  mediaCount,
  slug,
}: {
  categories: Category[];
  products: Product[];
  mediaCount: number;
  slug: string;
}) {
  const cards = [
    ["Categorias", categories.length],
    ["Produtos", products.length],
    ["Disponíveis", products.filter((p) => p.available).length],
    ["Arquivos de mídia", mediaCount],
  ];
  return (
    <>
      <Header title="Visão geral" text="Acompanhe o conteúdo publicado no seu cardápio." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article
            key={String(label)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <p className="text-sm text-stone-400">{label}</p>
            <strong className="mt-2 block text-3xl text-amber-400">{value}</strong>
          </article>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-white/10 bg-stone-950 p-6">
        <h2 className="font-bold">Link do cardápio</h2>
        <code className="mt-3 block overflow-auto rounded-xl bg-black/30 p-4 text-sm text-amber-300">
          /menu/{slug}
        </code>
        <p className="mt-3 text-sm text-stone-500">Use este endereço no QR Code das mesas.</p>
      </div>
    </>
  );
}

function CategoriesPanel({
  establishmentId,
  categories,
  busy,
  run,
}: {
  establishmentId: string;
  categories: Category[];
  busy: boolean;
  run: (w: () => Promise<unknown>, m: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <>
      <Header title="Categorias" text="Organize as seções do cardápio." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          run(
            () =>
              createCategory({
                establishment_id: establishmentId,
                name: name.trim(),
                sort_order: categories.length,
              }),
            "Categoria criada.",
          );
          setName("");
        }}
        className="mb-5 flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Pratos principais"
          className="field"
        />
        <button disabled={busy} className="primary">
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>
      <div className="space-y-3">
        {categories.length === 0 && <Empty text="Nenhuma categoria cadastrada." />}
        {categories.map((category, index) => (
          <article
            key={category.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <input
              defaultValue={category.name}
              onBlur={(e) =>
                e.target.value !== category.name &&
                run(
                  () => updateCategory(category.id, { name: e.target.value }),
                  "Categoria atualizada.",
                )
              }
              className="field min-w-52 flex-1"
            />
            <label className="flex items-center gap-2 text-sm text-stone-400">
              <input
                type="checkbox"
                checked={category.visible}
                onChange={(e) =>
                  run(
                    () => updateCategory(category.id, { visible: e.target.checked }),
                    "Visibilidade atualizada.",
                  )
                }
              />
              Visível
            </label>
            <input
              aria-label="Ordem"
              type="number"
              defaultValue={category.sort_order ?? index}
              onBlur={(e) =>
                run(
                  () => updateCategory(category.id, { sort_order: Number(e.target.value) }),
                  "Ordem atualizada.",
                )
              }
              className="field w-20"
            />
            <button
              onClick={() =>
                confirm("Excluir esta categoria? Os produtos ficarão sem categoria.") &&
                run(() => deleteCategory(category.id), "Categoria excluída.")
              }
              className="icon-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function ProductsPanel({
  establishmentId,
  categories,
  products,
  media,
  busy,
  run,
}: {
  establishmentId: string;
  categories: Category[];
  products: Product[];
  media: ProductMedia[];
  busy: boolean;
  run: (w: () => Promise<unknown>, m: string) => void;
}) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <Header
          title="Produtos e mídia 3D"
          text="Cadastre pratos, preços, dimensões reais e arquivos."
        />
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="primary"
        >
          <Plus className="h-4 w-4" />
          Novo produto
        </button>
      </div>
      {open && (
        <ProductForm
          establishmentId={establishmentId}
          categories={categories}
          product={editing}
          media={editing ? media.filter((item) => item.product_id === editing.id) : []}
          busy={busy}
          onClose={() => setOpen(false)}
          run={run}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {products.length === 0 && (
          <Empty text="Seu cardápio está vazio. Cadastre o primeiro produto." />
        )}
        {products.map((product) => {
          const productMedia = media.filter((item) => item.product_id === product.id);
          return (
            <article
              key={product.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400">
                    {categories.find((c) => c.id === product.category_id)?.name ?? "Sem categoria"}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{product.name}</h2>
                </div>
                <span
                  className={`h-fit rounded-full px-3 py-1 text-xs ${product.available ? "bg-emerald-500/15 text-emerald-300" : "bg-stone-500/15 text-stone-400"}`}
                >
                  {product.available ? "Disponível" : "Oculto"}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-stone-400">
                {product.description || "Sem descrição"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {productMedia.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-stone-400"
                  >
                    {MEDIA_RULES[item.media_type].label}
                  </span>
                ))}
                {productMedia.length === 0 && (
                  <span className="text-xs text-stone-600">Sem mídia</span>
                )}
              </div>
              <strong className="mt-4 block text-lg text-amber-400">
                {formatBRL(Number(product.price))}
              </strong>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setEditing(product);
                    setOpen(true);
                  }}
                  className="secondary"
                >
                  Editar e gerenciar mídia
                </button>
                <button
                  onClick={() =>
                    confirm("Excluir produto e suas mídias?") &&
                    run(async () => {
                      await removeFromBucket(productMedia.map((item) => item.storage_path));
                      await deleteProduct(product.id);
                    }, "Produto excluído.")
                  }
                  className="icon-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function ProductForm({
  establishmentId,
  categories,
  product,
  media,
  busy,
  onClose,
  run,
}: {
  establishmentId: string;
  categories: Category[];
  product: Product | null;
  media: ProductMedia[];
  busy: boolean;
  onClose: () => void;
  run: (w: () => Promise<unknown>, m: string) => void;
}) {
  const [kind, setKind] = useState<MediaKind>("image");
  const [file, setFile] = useState<File | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      establishment_id: establishmentId,
      name: String(data.get("name")),
      description: String(data.get("description")) || null,
      price: Number(data.get("price")),
      category_id: String(data.get("category_id")) || null,
      available: data.get("available") === "on",
      tags: String(data.get("tags"))
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      real_width_cm: Number(data.get("width")) || null,
      real_height_cm: Number(data.get("height")) || null,
      real_depth_cm: Number(data.get("depth")) || null,
    };
    run(
      async () => {
        const id = product
          ? (await updateProduct(product.id, payload), product.id)
          : (await createProduct(payload)).id;
        if (file) {
          const error = validateMediaFile(kind, file);
          if (error) throw new Error(error);
          const path = buildStoragePath(establishmentId, id, file);
          await uploadToBucket(path, file);
          await insertMedia({
            establishment_id: establishmentId,
            product_id: id,
            media_type: kind,
            storage_path: path,
            sort_order: 0,
          });
        }
        onClose();
      },
      product ? "Produto atualizado." : "Produto criado.",
    );
  };
  return (
    <form
      onSubmit={submit}
      className="mb-6 grid gap-4 rounded-3xl border border-amber-400/20 bg-stone-950 p-5 md:grid-cols-2"
    >
      <h2 className="text-xl font-bold md:col-span-2">
        {product ? "Editar produto" : "Novo produto"}
      </h2>
      <label>
        Nome
        <input name="name" required defaultValue={product?.name} className="field mt-1" />
      </label>
      <label>
        Preço (R$)
        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={String(product?.price ?? "")}
          className="field mt-1"
        />
      </label>
      <label>
        Categoria
        <select name="category_id" defaultValue={product?.category_id ?? ""} className="field mt-1">
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tags separadas por vírgula
        <input name="tags" defaultValue={product?.tags?.join(", ")} className="field mt-1" />
      </label>
      <label className="md:col-span-2">
        Descrição
        <textarea
          name="description"
          defaultValue={product?.description ?? ""}
          className="field mt-1 min-h-24"
        />
      </label>
      <fieldset className="grid grid-cols-3 gap-2 md:col-span-2">
        <legend className="mb-2 text-sm text-stone-400">Dimensões reais (cm)</legend>
        {[
          ["width", "Largura", product?.real_width_cm],
          ["height", "Altura", product?.real_height_cm],
          ["depth", "Profundidade", product?.real_depth_cm],
        ].map(([n, l, v]) => (
          <label key={String(n)}>
            {l}
            <input
              name={String(n)}
              type="number"
              step="0.1"
              min="0"
              defaultValue={String(v ?? "")}
              className="field mt-1"
            />
          </label>
        ))}
      </fieldset>
      <label>
        Tipo de mídia
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as MediaKind)}
          className="field mt-1"
        >
          {Object.entries(MEDIA_RULES).map(([value, rule]) => (
            <option key={value} value={value}>
              {rule.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Arquivo
        <input
          type="file"
          accept={MEDIA_RULES[kind].accept}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm text-stone-400"
        />
      </label>
      {media.length > 0 && (
        <div className="md:col-span-2">
          <p className="mb-2 text-sm text-stone-400">Mídias cadastradas</p>
          <div className="space-y-2">
            {media.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2"
              >
                <span className="text-sm">{MEDIA_RULES[item.media_type].label}</span>
                <button
                  type="button"
                  className="icon-danger"
                  onClick={() =>
                    confirm("Excluir esta mídia?") &&
                    run(async () => {
                      await removeFromBucket([item.storage_path]);
                      await deleteMedia(item.id);
                    }, "Mídia excluída.")
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2">
        <input name="available" type="checkbox" defaultChecked={product?.available ?? true} />
        Disponível no cardápio
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="secondary">
          Cancelar
        </button>
        <button disabled={busy} className="primary">
          <Save className="h-4 w-4" />
          Salvar
        </button>
      </div>
    </form>
  );
}

function SettingsPanel({
  establishment,
  busy,
  run,
}: {
  establishment: NonNullable<ReturnType<typeof useMyEstablishment>["data"]>;
  busy: boolean;
  run: (w: () => Promise<unknown>, m: string) => void;
}) {
  const [hours, setHours] = useState<OpeningHours>(() =>
    normalizeHours(establishment.opening_hours),
  );
  const [logo, setLogo] = useState<File | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    run(async () => {
      let logoUrl = establishment.logo_url;
      if (logo) {
        const error = validateMediaFile("image", logo);
        if (error) throw new Error(error);
        const path = buildStoragePath(establishment.id, "branding", logo);
        await uploadToBucket(path, logo);
        logoUrl = path;
      }
      await updateEstablishment(establishment.id, {
        name: String(d.get("name")),
        logo_url: logoUrl,
        address: String(d.get("address")) || null,
        phone: String(d.get("phone")) || null,
        business_category: String(d.get("business_category")) || null,
        social_links: {
          instagram: String(d.get("instagram")) || null,
          whatsapp: String(d.get("whatsapp")) || null,
        },
        opening_hours: hours,
        theme: { primary: String(d.get("primary")) },
      });
    }, "Configurações salvas.");
  };
  const socials = establishment.social_links as { instagram?: string; whatsapp?: string } | null;
  return (
    <>
      <Header title="Aparência e dados" text="Informações exibidas no cardápio público." />
      <form
        onSubmit={submit}
        className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:grid-cols-2"
      >
        <label>
          Nome
          <input name="name" required defaultValue={establishment.name} className="field mt-1" />
        </label>
        <label>
          Categoria do negócio
          <input
            name="business_category"
            defaultValue={establishment.business_category ?? ""}
            className="field mt-1"
          />
        </label>
        <label>
          Telefone
          <input name="phone" defaultValue={establishment.phone ?? ""} className="field mt-1" />
        </label>
        <label>
          Cor principal
          <input
            name="primary"
            type="color"
            defaultValue={String(
              (establishment.theme as { primary?: string } | null)?.primary ?? "#f59e0b",
            )}
            className="field mt-1 h-12"
          />
        </label>
        <label className="md:col-span-2">
          Endereço
          <textarea
            name="address"
            defaultValue={establishment.address ?? ""}
            className="field mt-1"
          />
        </label>
        <label>
          Instagram
          <input
            name="instagram"
            placeholder="@seurestaurante"
            defaultValue={socials?.instagram ?? ""}
            className="field mt-1"
          />
        </label>
        <label>
          WhatsApp
          <input
            name="whatsapp"
            placeholder="5567999999999"
            defaultValue={socials?.whatsapp ?? ""}
            className="field mt-1"
          />
        </label>
        <label className="md:col-span-2">
          Logo do estabelecimento
          <input
            type="file"
            accept={MEDIA_RULES.image.accept}
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-stone-400"
          />
        </label>
        <fieldset className="space-y-3 md:col-span-2">
          <legend className="mb-3 font-semibold text-white">Horários de funcionamento</legend>
          {WEEK_DAYS.map((day) => (
            <div
              key={day.key}
              className="grid items-center gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_auto_130px_130px]"
            >
              <strong>{day.label}</strong>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hours[day.key].closed}
                  onChange={(e) =>
                    setHours((current) => ({
                      ...current,
                      [day.key]: { ...current[day.key], closed: e.target.checked },
                    }))
                  }
                />
                Fechado
              </label>
              <input
                aria-label={`Abertura de ${day.label}`}
                type="time"
                disabled={hours[day.key].closed}
                value={hours[day.key].open}
                onChange={(e) =>
                  setHours((current) => ({
                    ...current,
                    [day.key]: { ...current[day.key], open: e.target.value },
                  }))
                }
                className="field"
              />
              <input
                aria-label={`Fechamento de ${day.label}`}
                type="time"
                disabled={hours[day.key].closed}
                value={hours[day.key].close}
                onChange={(e) =>
                  setHours((current) => ({
                    ...current,
                    [day.key]: { ...current[day.key], close: e.target.value },
                  }))
                }
                className="field"
              />
            </div>
          ))}
        </fieldset>
        <button disabled={busy} className="primary md:col-span-2 md:justify-self-end">
          <Save className="h-4 w-4" />
          Salvar configurações
        </button>
      </form>
    </>
  );
}

function Header({ title, text }: { title: string; text: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-stone-400">{text}</p>
    </header>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-10 text-center text-stone-500">
      {text}
    </div>
  );
}
