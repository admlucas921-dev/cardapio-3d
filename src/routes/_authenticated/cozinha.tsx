import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Check, Clock3, Flame, RefreshCw, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useMyEstablishment, useSessionUser } from "@/hooks/useEstablishment";
import { fetchKitchenOrders, updateOrderStatus, type KitchenOrder, type OrderStatus } from "@/lib/api";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cozinha")({ component: KitchenPage });

const columns: { status: OrderStatus; title: string; icon: typeof Clock3; color: string }[] = [
  { status: "new", title: "Novos", icon: Clock3, color: "text-amber-300" },
  { status: "preparing", title: "Em preparo", icon: Flame, color: "text-orange-400" },
  { status: "ready", title: "Prontos", icon: Check, color: "text-emerald-400" },
];

function KitchenPage() {
  const { userId } = useSessionUser();
  const establishmentQuery = useMyEstablishment(userId);
  const establishment = establishmentQuery.data;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const ordersQuery = useQuery({
    queryKey: ["kitchen-orders", establishment?.id],
    queryFn: () => fetchKitchenOrders(establishment!.id),
    enabled: !!establishment,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!establishment) return;
    const channel = supabase.channel(`kitchen-${establishment.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `establishment_id=eq.${establishment.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["kitchen-orders", establishment.id] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [establishment, queryClient]);

  async function move(order: KitchenOrder, status: OrderStatus) {
    setBusy(order.id);
    try {
      await updateOrderStatus(order.id, status);
      await ordersQuery.refetch();
      toast.success(status === "completed" ? "Pedido finalizado." : "Status atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o pedido.");
    } finally { setBusy(null); }
  }

  if (establishmentQuery.isLoading) return <Loading />;
  if (!establishment) return <main className="grid min-h-screen place-items-center bg-[#100b08] text-stone-100"><Link to="/admin" className="primary">Concluir cadastro</Link></main>;
  const orders = ordersQuery.data ?? [];

  return (
    <main className="min-h-screen bg-[#100b08] p-4 text-stone-100 md:p-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-stone-950"><ChefHat /></span><div><p className="text-xs uppercase tracking-widest text-amber-400">{establishment.name}</p><h1 className="text-2xl font-bold">Painel da cozinha</h1></div></div>
        <div className="flex gap-2"><button onClick={() => ordersQuery.refetch()} className="secondary"><RefreshCw className={`h-4 w-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />Atualizar</button><Link to="/admin" className="secondary">Voltar ao admin</Link></div>
      </header>
      <section className="mx-auto mt-6 grid max-w-7xl gap-5 lg:grid-cols-3">
        {columns.map(({ status, title, icon: Icon, color }) => {
          const list = orders.filter(order => order.status === status);
          return <div key={status} className="min-h-72 rounded-3xl border border-white/10 bg-stone-950/70 p-4"><div className="mb-4 flex items-center justify-between"><h2 className={`flex items-center gap-2 font-bold ${color}`}><Icon className="h-5 w-5" />{title}</h2><span className="rounded-full bg-white/10 px-3 py-1 text-sm">{list.length}</span></div><div className="space-y-4">{list.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-stone-600">Nenhum pedido nesta etapa.</p>}{list.map(order => <OrderCard key={order.id} order={order} busy={busy === order.id} move={move} />)}</div></div>;
        })}
      </section>
    </main>
  );
}

function OrderCard({ order, busy, move }: { order: KitchenOrder; busy: boolean; move: (order: KitchenOrder, status: OrderStatus) => void }) {
  const age = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000));
  return <article className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-xl shadow-black/20"><div className="flex items-start justify-between gap-3"><div><strong className="text-xl text-amber-300">#{order.order_number}</strong><h3 className="font-semibold">{order.customer_name}</h3></div><span className="text-xs text-stone-500">há {age} min</span></div>{order.table_number && <p className="mt-2 rounded-lg bg-amber-400/10 px-2 py-1 text-sm text-amber-200">Mesa/Comanda: {order.table_number}</p>}<ul className="mt-4 space-y-2">{order.order_items.map(item => <li key={item.id} className="flex gap-2 text-sm"><b className="text-amber-400">{item.quantity}×</b><span>{item.product_name}</span></li>)}</ul>{order.notes && <p className="mt-4 rounded-xl border border-orange-400/20 bg-orange-400/5 p-3 text-sm text-orange-100"><b>Observação:</b> {order.notes}</p>}<div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3"><strong>{formatBRL(Number(order.total))}</strong>{order.status === "new" && <button disabled={busy} onClick={() => move(order, "preparing")} className="primary">Iniciar preparo</button>}{order.status === "preparing" && <button disabled={busy} onClick={() => move(order, "ready")} className="primary">Marcar pronto</button>}{order.status === "ready" && <button disabled={busy} onClick={() => move(order, "completed")} className="primary"><UtensilsCrossed className="h-4 w-4" />Entregue</button>}</div></article>;
}

function Loading() { return <div className="grid min-h-screen place-items-center bg-[#100b08] text-amber-400">Carregando cozinha…</div>; }
