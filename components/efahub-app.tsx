"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  MoreHorizontal,
  Moon,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Monitor,
  Store,
  UserRound,
  Users,
  Wallet,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  businesses,
  formatCurrency,
  formatDate,
  makeInitialAppointments,
  professionals,
  roleOptions,
  services
} from "@/lib/demo-data";
import type { Appointment, Booking, Role } from "@/lib/demo-data";
import { ClientBusinessView, ClientSearchView, NewClientForm, QuickBookingForm, ReportsView } from "@/components/role-pages";
import type { LucideIcon } from "lucide-react";
import { defaultRoute, viewRoute } from "@/lib/routes";
import { nextThemePreference, normalizeThemePreference, resolveThemePreference, THEME_STORAGE_KEY } from "@/lib/theme";
import type { ResolvedTheme, ThemePreference } from "@/lib/theme";

const FAVORITES_STORAGE_KEY = "efahub-favorite-businesses-v1";

export type ViewId =
  | "home" | "search" | "business" | "companyServices" | "appointments" | "favorites" | "notifications" | "profile"
  | "agenda" | "clients" | "earnings" | "checkin" | "payments"
  | "newBooking" | "newClient" | "reports"
  | "team" | "services" | "finance" | "marketing" | "inventory" | "settings"
  | "businesses" | "subscriptions" | "support" | "audit";

type NavEntry = { id: ViewId; label: string; icon: LucideIcon };
type Props = { role: Role; view: ViewId; appointments: Appointment[]; onBook: () => void; onToast: (message: string) => void; onComplete: (id: number) => void; onQuickCreate: (appointment: Omit<Appointment, "id">) => void; onNavigate: (view: ViewId) => void; onViewBusiness: (businessId: string, servicesOnly?: boolean) => void; businessId: string; favoriteBusinessIds: string[]; onToggleFavorite: (businessId: string) => void; themePreference: ThemePreference; resolvedTheme: ResolvedTheme; onThemeChange: (preference: ThemePreference) => void };
const bookingContactSchema = z.object({
  customer: z.string().trim().min(2, "Informe seu nome.").max(80, "Use até 80 caracteres."),
  phone: z.string().max(20).refine((value) => !value || /^\(\d{2}\) 9\d{4}-\d{4}$/.test(value), "Use o formato (11) 99999-9999.")
});
type BookingContact = z.infer<typeof bookingContactSchema>;

const navigation: Record<Role, NavEntry[]> = {
  client: [
    { id: "home", label: "Início", icon: LayoutDashboard },
    { id: "appointments", label: "Agendamentos", icon: CalendarDays },
    { id: "favorites", label: "Favoritos", icon: Heart },
    { id: "notifications", label: "Notificações", icon: Bell },
    { id: "profile", label: "Meu perfil", icon: UserRound }
  ],
  professional: [
    { id: "home", label: "Meu dia", icon: LayoutDashboard },
    { id: "agenda", label: "Agenda", icon: CalendarDays },
    { id: "clients", label: "Clientes", icon: Users },
    { id: "earnings", label: "Ganhos", icon: Wallet },
    { id: "profile", label: "Meu perfil", icon: UserRound }
  ],
  employee: [
    { id: "home", label: "Visão geral", icon: LayoutDashboard },
    { id: "agenda", label: "Agenda geral", icon: CalendarDays },
    { id: "clients", label: "Clientes", icon: Users },
    { id: "checkin", label: "Check-in", icon: Check },
    { id: "payments", label: "Pagamentos", icon: CreditCard }
  ],
  businessAdmin: [
    { id: "home", label: "Visão executiva", icon: LayoutDashboard },
    { id: "agenda", label: "Agenda", icon: CalendarDays },
    { id: "clients", label: "Clientes e CRM", icon: Users },
    { id: "team", label: "Profissionais", icon: UserRound },
    { id: "services", label: "Serviços", icon: Sparkles },
    { id: "finance", label: "Financeiro", icon: Wallet },
    { id: "marketing", label: "Marketing", icon: Activity },
    { id: "inventory", label: "Estoque", icon: Package },
    { id: "settings", label: "Configurações", icon: Settings }
  ],
  platformAdmin: [
    { id: "home", label: "Visão global", icon: LayoutDashboard },
    { id: "businesses", label: "Empresas", icon: Store },
    { id: "subscriptions", label: "Assinaturas", icon: CreditCard },
    { id: "finance", label: "Financeiro", icon: Wallet },
    { id: "support", label: "Suporte", icon: CircleHelp },
    { id: "audit", label: "Auditoria", icon: ShieldCheck }
  ]
};

const roleTitles: Record<Role, string> = {
  client: "Olá, João 👋",
  professional: "Bom dia, Marina",
  employee: "Olá, Fernanda",
  businessAdmin: "Visão executiva",
  platformAdmin: "Visão global EFAHub"
};

function MetricCard({ label, value, note, icon: Icon, trend, accent = false }: { label: string; value: string; note: string; icon: LucideIcon; trend?: string; accent?: boolean }) {
  return (
    <article className={`metric-card rounded-2xl border p-5 shadow-soft ${accent ? "border-transparent bg-ink text-white" : "border-[#e8e9e6] bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className={accent ? "text-sm text-white/65" : "text-sm text-muted"}>{label}</p><p className="mt-4 text-2xl font-bold tracking-tight">{value}</p></div>
        <span className="metric-icon"><Icon size={17} /></span>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs">
        {trend && <span className="flex items-center font-semibold text-success"><ArrowUpRight size={14} />{trend}</span>}
        <span className={accent ? "text-white/55" : "text-muted"}>{note}</span>
      </div>
    </article>
  );
}

function SectionHeading({ title, detail, action, onAction }: { title: string; detail?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div><h2 className="text-base font-bold text-ink">{title}</h2>{detail && <p className="mt-1 text-sm text-muted">{detail}</p>}</div>
      {action && <button className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline" onClick={onAction} type="button">{action}<ArrowRight size={15} /></button>}
    </div>
  );
}

function DemoNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#ded3f4] bg-[#f7f4fc] px-4 py-3 text-xs leading-5 text-[#57408f]">
      <Sparkles className="mt-0.5 shrink-0" size={16} />
      <p><strong>Ambiente de demonstração.</strong> Perfis e informações são fictícios. Este seletor não autentica usuários, e os dados ainda não são protegidos por permissões de servidor.</p>
    </div>
  );
}

function ThemePreferencePanel({ preference, resolvedTheme, onChange }: { preference: ThemePreference; resolvedTheme: ResolvedTheme; onChange: (preference: ThemePreference) => void }) {
  const options: { value: ThemePreference; label: string; detail: string; icon: LucideIcon }[] = [
    { value: "light", label: "Claro", detail: "Para ambientes iluminados", icon: Sun },
    { value: "dark", label: "Escuro", detail: "Para ambientes com pouca luz", icon: Moon },
    { value: "auto", label: "Automático", detail: "Claro das 06h às 17h59; escuro das 18h às 05h59", icon: Monitor }
  ];

  return <section className="theme-settings rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6" aria-labelledby="theme-settings-title"><div className="mb-4"><h2 id="theme-settings-title" className="font-bold">Aparência</h2><p className="mt-1 text-sm text-muted">Preferência salva somente neste navegador neste protótipo.</p></div><fieldset><legend className="sr-only">Escolha o tema</legend><div className="grid gap-3 md:grid-cols-3">{options.map(({ value, label, detail, icon: Icon }) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${preference === value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[#e8e9e6] hover:border-[var(--accent)]"}`}><input className="mt-1 accent-[var(--accent)]" type="radio" name="theme-preference" value={value} checked={preference === value} onChange={() => onChange(value)} /><Icon className="mt-0.5 shrink-0 text-[var(--accent)]" size={18} /><span><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs leading-5 text-muted">{detail}</span></span></label>)}</div></fieldset><p className="mt-4 text-xs text-muted" role="status" aria-live="polite">Tema exibido: {resolvedTheme === "light" ? "claro" : "escuro"}.</p></section>;
}

function ThemeCycleButton({ preference, onChange }: { preference: ThemePreference; onChange: (preference: ThemePreference) => void }) {
  const next = nextThemePreference(preference);
  const Icon = preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;
  const labels: Record<ThemePreference, string> = { light: "claro", dark: "escuro", auto: "automático" };
  return <button type="button" onClick={() => onChange(next)} aria-label={`Tema ${labels[preference]}. Alternar para ${labels[next]}`} title={`Tema ${labels[preference]}`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#e8e9e6] text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"><Icon size={17} /></button>;
}

function AppointmentList({ items, showActions = false, onComplete, onToast }: { items: Appointment[]; showActions?: boolean; onComplete?: (id: number) => void; onToast: (message: string) => void }) {
  if (!items.length) return <div className="rounded-xl border border-dashed border-[#dfe1dc] px-5 py-10 text-center text-sm text-muted">Nenhum agendamento neste período.</div>;
  return (
    <div className="divide-y divide-[#eff0ed]">
      {items.map((item) => (
        <div className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0" key={item.id}>
          <div className="min-w-[66px] rounded-xl bg-[#f4f4f1] px-3 py-2 text-center"><span className="block text-xs text-muted">{formatDate(item.date)}</span><strong className="mt-1 block text-sm">{item.time}</strong></div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.customer}</p><p className="mt-1 text-xs text-muted">{item.service} <span className="px-1">·</span> {item.professional}</p></div>
          <div className="ml-auto flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === "Concluído" ? "bg-[#e7f2eb] text-[#217a5b]" : item.status === "Aguardando" ? "bg-[#fff3df] text-[#8b6221]" : "bg-[#eef0f3] text-[#536170]"}`}>{item.status}</span><span className="hidden text-sm font-semibold sm:block">{formatCurrency(item.price)}</span></div>
          {showActions && <div className="flex w-full justify-end gap-2 sm:w-auto"><button type="button" className="rounded-lg border border-[#e4e5e1] px-3 py-2 text-xs font-semibold hover:bg-[#f7f7f5]" onClick={() => onToast(`Detalhes de ${item.customer}`)}>Ver detalhes</button>{item.status !== "Concluído" && <button type="button" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90" onClick={() => onComplete?.(item.id)}>Finalizar</button>}</div>}
        </div>
      ))}
    </div>
  );
}

function BusinessCards({ onBook, onViewBusiness, favoriteBusinessIds, onToggleFavorite, items = businesses }: { onBook: () => void; onViewBusiness: (businessId: string, servicesOnly?: boolean) => void; favoriteBusinessIds: string[]; onToggleFavorite: (businessId: string) => void; items?: typeof businesses }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((business, index) => (
        <article className="overflow-hidden rounded-2xl border border-[#ebe8e3] bg-white shadow-soft" key={business.id}>
          <div className={`flex h-32 items-end p-4 ${index === 0 ? "bg-gradient-to-br from-[#d2c0ff] to-[#f0eafa]" : index === 1 ? "bg-gradient-to-br from-[#b99fff] to-[#eeeafb]" : "bg-gradient-to-br from-[#d8d0f0] to-[#f1eef8]"}`}>
            <span className="grid size-12 place-items-center rounded-2xl bg-white/90 text-sm font-bold text-ink shadow">{business.image}</span>
            <button type="button" aria-label={`${favoriteBusinessIds.includes(business.id) ? "Remover dos favoritos" : "Favoritar"} ${business.name}`} aria-pressed={favoriteBusinessIds.includes(business.id)} onClick={() => onToggleFavorite(business.id)} className="ml-auto grid size-9 place-items-center rounded-full bg-white/90 text-[var(--accent)]"><Heart size={17} fill={favoriteBusinessIds.includes(business.id) ? "currentColor" : "none"} /></button>
          </div>
          <div className="p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">{business.name}</h3><p className="mt-1 text-xs text-muted">{business.category}</p></div><span className="flex items-center gap-1 text-xs font-semibold"><Star size={13} className="fill-[#d6a64c] text-[#d6a64c]" />{business.rating}</span></div>
            <p className="mt-3 flex items-center gap-1 text-xs text-muted"><MapPin size={13} />{business.distance} · {business.location}</p>
            <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => onViewBusiness(business.id)} className="rounded-xl border border-[#e8e9e6] px-3 py-2.5 text-sm font-semibold">Ver perfil</button><button type="button" onClick={onBook} className="rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90">Agendar horário</button></div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ClientHome({ appointments, onBook, onToast, onNavigate, onViewBusiness, favoriteBusinessIds, onToggleFavorite }: Props) {
  const [query, setQuery] = useState("");
  const next = appointments.find((appointment) => appointment.status !== "Concluído");
  const filtered = businesses.filter((business) => `${business.name} ${business.category}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--accent)]">SUA PRÓXIMA EXPERIÊNCIA COMEÇA AQUI</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{roleTitles.client}</h1><p className="mt-2 text-sm text-muted">Encontre um lugar especial para cuidar de você.</p></div><button type="button" onClick={onBook} className="hidden rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm sm:inline-flex"><Plus size={17} className="mr-2" />Novo agendamento</button></div>
      <label className="mb-7 flex items-center gap-3 rounded-2xl border border-[#e9e5df] bg-white px-4 py-4 shadow-soft"><Search size={19} className="text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted" placeholder="Buscar empresas, profissionais ou serviços" aria-label="Buscar empresas, profissionais ou serviços" /></label>
      <div className="mb-8 grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
        <section className="rounded-2xl bg-gradient-to-br from-[#30263f] to-[#211d29] p-6 text-white sm:p-8"><p className="text-xs font-semibold tracking-[.16em] text-[#d2c0ff]">SEU MOMENTO, DO SEU JEITO</p><h2 className="mt-4 max-w-md text-2xl font-bold leading-tight sm:text-3xl">Um tempo para você faz toda a diferença.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-white/70">Descubra profissionais incríveis e reserve seu próximo cuidado em poucos passos.</p><button onClick={onBook} type="button" className="mt-6 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#30263f]">Encontrar um horário <ArrowRight className="ml-2 inline" size={16} /></button></section>
        <section className="rounded-2xl border border-[#ebe8e3] bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold tracking-wider text-[var(--accent)]">SEU PRÓXIMO AGENDAMENTO</p><h2 className="mt-2 font-bold">{next?.service ?? "Seu próximo cuidado"}</h2></div><CalendarDays className="text-[var(--accent)]" size={21} /></div>{next ? <><div className="mt-4 rounded-xl bg-[#f7f4fc] p-4"><p className="font-semibold">{businesses[0].name}</p><p className="mt-1 text-sm text-muted">{next.professional} · {formatDate(next.date)} às {next.time}</p><p className="mt-2 text-sm font-semibold">{formatCurrency(next.price)}</p></div><div className="mt-3 flex gap-2"><button onClick={() => onToast("A jornada de reagendamento será conectada ao backend.")} type="button" className="flex-1 rounded-lg border border-[#e9e5df] py-2 text-xs font-semibold">Remarcar</button><button onClick={() => onToast("A rota será aberta quando houver uma localização real.")} type="button" className="flex-1 rounded-lg border border-[#e9e5df] py-2 text-xs font-semibold">Abrir rota</button></div></> : <button onClick={onBook} type="button" className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Agendar agora</button>}</section>
      </div>
      <div className="mb-8"><SectionHeading title="Empresas em destaque" detail="Lugares bem avaliados perto de você" action="Ver todas" onAction={() => onNavigate("search")} /><BusinessCards onBook={onBook} onViewBusiness={onViewBusiness} favoriteBusinessIds={favoriteBusinessIds} onToggleFavorite={onToggleFavorite} /></div>
      <div className="grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-[#ebe8e3] bg-white p-5 shadow-soft"><SectionHeading title="Serviços populares" detail="Escolha o que combina com você" /><div className="grid grid-cols-2 gap-3">{["Corte", "Barba", "Sobrancelha", "Massagem", "Limpeza de pele", "Terapias"].map((item) => <button key={item} type="button" onClick={onBook} className="rounded-xl bg-[#f7f4fc] px-3 py-4 text-left text-sm font-semibold hover:bg-[#eeeafb]">{item}<ArrowRight className="float-right text-muted" size={16} /></button>)}</div></section><section className="rounded-2xl border border-[#ebe8e3] bg-white p-5 shadow-soft"><SectionHeading title="Novidades para você" detail="Inspiração e vantagens da comunidade" /><div className="space-y-3"><div className="rounded-xl bg-[#f0eafa] p-4"><p className="text-xs font-bold tracking-wider text-[#7853d6]">BEM-VINDA DE VOLTA</p><p className="mt-2 text-sm font-semibold">Seu próximo momento de autocuidado está esperando.</p></div><div className="rounded-xl bg-[#eeeafb] p-4"><p className="text-xs font-bold tracking-wider text-[#695c8b]">DICA EFAHUB</p><p className="mt-2 text-sm font-semibold">Salve seus lugares favoritos para encontrar mais rápido.</p></div></div></section></div>
      {query && <div className="mt-8"><SectionHeading title="Resultados da busca" /><BusinessCards onBook={onBook} onViewBusiness={onViewBusiness} favoriteBusinessIds={favoriteBusinessIds} onToggleFavorite={onToggleFavorite} items={filtered} />{filtered.length === 0 && <p className="text-sm text-muted">Nenhum resultado encontrado.</p>}</div>}
    </>
  );
}

function BusinessDashboard({ appointments, onToast, onComplete, onNavigate }: Props) {
  const total = appointments.filter((item) => item.status === "Concluído").reduce((sum, item) => sum + item.price, 0);
  return (
    <>
      <DemoNotice />
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">QUINTA-FEIRA · PAINEL DO NEGÓCIO</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{roleTitles.businessAdmin}</h1><p className="mt-2 text-sm text-muted">Acompanhe a operação e tome decisões com confiança.</p></div><button type="button" onClick={() => onNavigate("newBooking")} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"><Plus className="mr-2 inline" size={16} />Novo agendamento</button></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Receita realizada hoje" value={formatCurrency(total || 1260)} note="vs. período anterior" icon={Wallet} trend="+12,8%" accent />
        <MetricCard label="Agendamentos" value={`${appointments.length + 18}`} note="5 aguardando atendimento" icon={CalendarDays} trend="+8,2%" />
        <MetricCard label="Novos clientes" value="24" note="neste mês" icon={Users} trend="+4,6%" />
        <MetricCard label="Ocupação da agenda" value="78%" note="meta mensal: 82%" icon={Activity} trend="+3,1%" />
      </div>
      <div className="mb-6 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Receita ao longo do tempo" detail="Visão ilustrativa · últimos 7 dias" action="Relatórios" onAction={() => onNavigate("reports")} /><RevenueChart /></section>
        <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Resumo de desempenho" detail="Metas e indicadores do mês" /><div className="space-y-5"><Progress label="Meta de receita" value="R$ 18.450 de R$ 25.000" percent={74} /><Progress label="Clientes recorrentes" value="68% da base ativa" percent={68} /><Progress label="Ocupação" value="78% da capacidade" percent={78} /><div className="flex items-center justify-between border-t border-[#eee] pt-4 text-sm"><span className="text-muted">Ticket médio</span><strong>R$ 112,50</strong></div></div></section>
      </div>
      <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Próximos atendimentos" detail="Agenda da unidade · hoje" action="Abrir agenda" onAction={() => onNavigate("agenda")} /><AppointmentList items={appointments} showActions onComplete={onComplete} onToast={onToast} /></section>
      <div className="mt-6 grid gap-5 md:grid-cols-2"><InsightCard title="Oportunidade de recorrência" text="18 clientes habituais estão próximos do período médio de retorno." label="CRM" /><InsightCard title="Horários com maior procura" text="Quinta-feira, entre 16h e 19h, concentra mais solicitações." label="AGENDA" /></div>
    </>
  );
}

function ProfessionalDashboard({ appointments, onToast, onComplete, onNavigate }: Props) {
  const todayAppointments = appointments.slice(0, 3);
  return (
    <>
      <DemoNotice />
      <div className="mb-7"><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">QUINTA-FEIRA · 6 DE NOVEMBRO</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{roleTitles.professional}</h1><p className="mt-2 text-sm text-muted">Aqui está o que importa para o seu dia.</p></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Atendimentos hoje" value="6" note="2 concluídos · 4 pela frente" icon={CalendarDays} /><MetricCard label="Receita gerada" value="R$ 680" note="comissões calculadas no demo" icon={Wallet} trend="+8%" /><MetricCard label="Próximo cliente" value="Beatriz" note="Coloração · 10:30" icon={Clock3} /><MetricCard label="Avaliação média" value="4,9" note="últimos atendimentos" icon={Star} trend="+0,2" /></div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Minha agenda" detail="Seus atendimentos de hoje" action="Ver semana" onAction={() => onNavigate("agenda")} /><AppointmentList items={todayAppointments} showActions onComplete={onComplete} onToast={onToast} /></section><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Resumo de ganhos" detail="Comissões estimadas" /><div className="rounded-xl bg-[#f7f6f2] p-4"><p className="text-xs text-muted">Hoje</p><p className="mt-1 text-2xl font-bold">R$ 204,00</p><p className="mt-1 text-xs text-muted">Semana: R$ 1.090,00</p></div><div className="mt-4 space-y-3"><Progress label="Meta do mês" value="R$ 3.240 de R$ 4.500" percent={72} /><p className="text-xs leading-5 text-muted">Os valores são demonstrativos e não representam pagamentos ou fechamento real de comissão.</p></div><button onClick={() => onNavigate("earnings")} type="button" className="mt-4 w-full rounded-xl border border-[#e5e6e2] py-2.5 text-sm font-semibold">Ver extrato</button></section></div>
      <div className="mt-6 grid gap-5 md:grid-cols-2"><InsightCard title="Cliente em destaque" text="João Almeida prefere horários pela manhã e corte tradicional." label="PERFIL DO CLIENTE" /><InsightCard title="Lembrete de atendimento" text="Confira as observações do próximo cliente antes de iniciar." label="PRÓXIMA AÇÃO" /></div>
    </>
  );
}

function EmployeeDashboard({ appointments, onToast, onComplete, onNavigate }: Props) {
  const quickActions: { title: string; detail: string; view: ViewId }[] = [
    { title: "Confirmar chegada", detail: "Registrar check-in do cliente", view: "checkin" },
    { title: "Novo cliente", detail: "Cadastrar contato e preferências", view: "newClient" },
    { title: "Receber pagamento", detail: "Registrar PIX, cartão ou dinheiro", view: "payments" },
    { title: "Registrar venda", detail: "Lançar produto e recebimento no caixa", view: "payments" }
  ];
  return (
    <>
      <DemoNotice />
      <div className="mb-7"><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">RECEPÇÃO · UNIDADE JARDINS</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{roleTitles.employee}</h1><p className="mt-2 text-sm text-muted">Resumo operacional para manter o atendimento fluindo.</p></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Aguardando chegada" value="3" note="1 cliente já chegou" icon={Users} /><MetricCard label="Agendamentos hoje" value={`${appointments.length + 12}`} note="em 3 profissionais" icon={CalendarDays} /><MetricCard label="Check-ins" value="8" note="2 nos próximos 30 min" icon={Check} /><MetricCard label="Pagamentos pendentes" value="R$ 420" note="4 atendimentos" icon={CreditCard} /></div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Fila de atendimento" detail="Acompanhe a chegada dos clientes" action="Abrir agenda" onAction={() => onNavigate("agenda")} /><AppointmentList items={appointments} showActions onComplete={onComplete} onToast={onToast} /></section><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Ações rápidas" detail="Rotina da recepção" /><div className="grid gap-3">{quickActions.map(({ title, detail, view }) => <button type="button" onClick={() => onNavigate(view)} key={title} className="flex items-center justify-between rounded-xl border border-[#ecece9] p-4 text-left hover:bg-[#fafaf8]"><span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs text-muted">{detail}</span></span><ArrowRight size={16} className="text-muted" /></button>)}</div></section></div>
    </>
  );
}

function PlatformDashboard({ onToast, onNavigate }: Props) {
  return (
    <>
      <DemoNotice />
      <div className="mb-7"><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">OPERAÇÃO DA PLATAFORMA</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{roleTitles.platformAdmin}</h1><p className="mt-2 text-sm text-muted">Acompanhe a saúde do ecossistema EFAHub.</p></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Empresas ativas" value="1.284" note="em todos os planos" icon={Store} trend="+9,4%" accent /><MetricCard label="MRR" value="R$ 184,6 mil" note="receita recorrente mensal" icon={Wallet} trend="+6,8%" /><MetricCard label="Agendamentos" value="48.291" note="nos últimos 30 dias" icon={CalendarDays} trend="+14,2%" /><MetricCard label="Tickets abertos" value="26" note="4 com prioridade alta" icon={CircleHelp} /></div>
      <div className="mb-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Crescimento da plataforma" detail="MRR ilustrativo · últimos 6 meses" /><RevenueChart /></section><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Saúde do ecossistema" detail="Indicadores operacionais" /><div className="space-y-5"><Progress label="Empresas com onboarding concluído" value="86% da base" percent={86} /><Progress label="Retenção de empresas" value="94,2% · 30 dias" percent={94} /><Progress label="SLA de suporte" value="91% dentro do prazo" percent={91} /><div className="flex items-center justify-between border-t border-[#eee] pt-4 text-sm"><span className="text-muted">Churn mensal</span><strong>2,4%</strong></div></div></section></div>
      <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Empresas para acompanhar" detail="Visão demonstrativa de contas e suporte" action="Abrir empresas" onAction={() => onNavigate("businesses")} /><PlatformBusinessTable onToast={onToast} /></section>
    </>
  );
}

function RevenueChart() {
  const points = [34, 48, 42, 63, 54, 72, 65, 86, 74, 91, 82, 98];
  return <div className="pt-4"><div className="flex h-48 items-end gap-2 border-b border-l border-[#eee] px-2 pb-0 sm:gap-4">{points.map((height, index) => <div key={index} className="group relative flex h-full flex-1 items-end"><span className="w-full rounded-t-md bg-gradient-to-t from-[#7853d6] to-[#b99fff] transition hover:opacity-80" style={{ height: `${height}%` }} title={`Período ${index + 1}`} /></div>)}</div><div className="mt-3 flex justify-between text-[11px] text-muted"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div><p className="mt-4 flex items-center gap-2 text-xs text-muted"><span className="size-2 rounded-full bg-[#7853d6]" />Receita registrada · valores ilustrativos</p></div>;
}

function Progress({ label, value, percent }: { label: string; value: string; percent: number }) {
  return <div><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="text-muted">{label}</span><strong>{value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#eff0ed]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} /></div></div>;
}

function InsightCard({ title, text, label }: { title: string; text: string; label: string }) {
  return <article className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft"><p className="text-[10px] font-bold tracking-[.14em] text-[var(--accent)]">{label}</p><h3 className="mt-2 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{text}</p></article>;
}

function PlatformBusinessTable({ onToast }: { onToast: (message: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-[10px] tracking-wider text-muted"><tr><th className="pb-3 font-semibold">EMPRESA</th><th className="pb-3 font-semibold">PLANO</th><th className="pb-3 font-semibold">STATUS</th><th className="pb-3 font-semibold">MRR</th><th className="pb-3 font-semibold">AÇÃO</th></tr></thead><tbody className="divide-y divide-[#eee]">{[["Ateliê Aurora", "Pro", "Ativa", "R$ 189"], ["Barbearia Central", "Essencial", "Ativa", "R$ 99"], ["Casa Serena", "Pro", "Em análise", "R$ 189"]].map((row) => <tr key={row[0]}><td className="py-4 font-semibold">{row[0]}</td><td className="py-4 text-muted">{row[1]}</td><td className="py-4"><span className="rounded-full bg-[#e8f2eb] px-2.5 py-1 text-xs font-semibold text-success">{row[2]}</span></td><td className="py-4">{row[3]}</td><td className="py-4"><button type="button" onClick={() => onToast(`Ações administrativas de ${row[0]} exigem autorização no backend.`)} className="rounded-lg border border-[#e5e6e2] px-3 py-1.5 text-xs font-semibold">Gerenciar</button></td></tr>)}</tbody></table></div>;
}

function ModuleView({ role, view, appointments, onBook, onToast, onComplete, onQuickCreate, onNavigate, onViewBusiness, businessId, favoriteBusinessIds, onToggleFavorite, themePreference, resolvedTheme, onThemeChange }: Props) {
  const upcoming = appointments.filter((item) => item.status !== "Concluído");
  const moduleTitles: Partial<Record<ViewId, [string, string]>> = {
    appointments: ["Meus agendamentos", "Consulte e gerencie suas próximas experiências."],
    agenda: ["Agenda", "Organize os atendimentos e acompanhe os horários disponíveis."],
    clients: ["Clientes", "Acesse histórico, preferências e relacionamento dos clientes."],
    favorites: ["Meus favoritos", "Seus profissionais e lugares preferidos em um só lugar."],
    notifications: ["Notificações", "Atualizações importantes sobre sua experiência."],
    profile: ["Meu perfil", "Suas informações e preferências da conta."],
    search: ["Buscar empresas", "Descubra lugares e serviços perto de você."],
    business: ["Perfil da empresa", "Conheça os serviços, profissionais e informações do local."],
    companyServices: ["Serviços da empresa", "Escolha um serviço e confira preço e duração."],
    newBooking: ["Novo agendamento", "Crie uma reserva assistida para o cliente."],
    newClient: ["Cadastrar cliente", "Registre os dados mínimos necessários para o atendimento."],
    earnings: ["Meus ganhos", "Acompanhe sua produção e comissões estimadas."],
    checkin: ["Check-in e fila", "Registre chegadas e acompanhe quem está aguardando."],
    payments: ["Pagamentos", "Registre recebimentos e acompanhe pendências."],
    team: ["Profissionais", "Equipe, metas, permissões e disponibilidade."],
    services: ["Serviços", "Catálogo, preços, duração e profissionais habilitados."],
    finance: ["Financeiro", "Receitas, despesas, comissões e relatórios."],
    reports: ["Relatórios", "Acompanhe resultados por período, serviço e profissional."],
    marketing: ["Marketing e fidelidade", "Campanhas, cupons, cashback e relacionamento."],
    inventory: ["Produtos e estoque", "Inventário, movimentações e alertas de reposição."],
    settings: ["Configurações", "Dados da empresa, unidades, horários e permissões."],
    businesses: ["Empresas", "Gestão de contas e ciclo de vida dos estabelecimentos."],
    subscriptions: ["Assinaturas e planos", "Planos, cobranças e status das assinaturas."],
    support: ["Central de suporte", "Chamados, priorização e acompanhamento de solicitações."],
    audit: ["Auditoria", "Atividades e alterações registradas na plataforma."]
  };
  const [title, detail] = moduleTitles[view] ?? ["Área de trabalho", "Resumo da operação."];
  const isClient = role === "client";
  const isPlatform = role === "platformAdmin";
  const isEmployee = role === "employee";
  const primaryAction = isClient ? "Encontrar horário" : isEmployee ? "Registrar chegada" : "Novo agendamento";
  const showPrimaryAction = view !== "newBooking" && view !== "newClient";

  return (
    <>
      <DemoNotice />
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">{roleOptions.find((item) => item.id === role)?.label.toUpperCase()}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted">{detail}</p></div>{showPrimaryAction && <button type="button" onClick={() => isClient ? onBook() : isEmployee ? onNavigate("checkin") : role === "businessAdmin" ? onNavigate("newBooking") : onToast(`${primaryAction}: ação demonstrativa.`)} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">{primaryAction}</button>}</div>
      {view === "favorites" && (favoriteBusinessIds.length ? <BusinessCards onBook={onBook} onViewBusiness={onViewBusiness} favoriteBusinessIds={favoriteBusinessIds} onToggleFavorite={onToggleFavorite} items={businesses.filter((business) => favoriteBusinessIds.includes(business.id))} /> : <section className="rounded-2xl border border-dashed border-[#dfe1dc] bg-white p-8 text-center"><h2 className="font-bold">Você ainda não salvou empresas</h2><p className="mt-2 text-sm text-muted">Toque no coração de uma empresa para encontrá-la aqui.</p><button type="button" onClick={() => onNavigate("search")} className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">Buscar empresas</button></section>)}
      {view === "search" && <ClientSearchView onBook={onBook} onViewBusiness={(id) => onViewBusiness(id)} />}
      {(view === "business" || view === "companyServices") && <ClientBusinessView onBook={onBook} onViewBusiness={onViewBusiness} businessId={businessId} servicesOnly={view === "companyServices"} />}
      {view === "newBooking" && <QuickBookingForm onCreate={onQuickCreate} />}
      {view === "newClient" && <NewClientForm onToast={onToast} />}
      {view === "reports" && <ReportsView />}
      {(view === "appointments" || view === "agenda" || view === "checkin") && <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title={view === "checkin" ? "Fila de atendimento" : "Próximos horários"} detail="Dados fictícios para demonstração" /><AppointmentList items={upcoming} showActions={!isClient} onComplete={onComplete} onToast={onToast} /></section>}
      {view === "clients" && <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Clientes recentes" detail="Histórico resumido baseado em dados de demonstração" /><div className="divide-y divide-[#eee]">{appointments.map((item) => <div key={item.id} className="flex items-center gap-3 py-4 first:pt-0"><span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">{item.customer.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="flex-1"><p className="text-sm font-semibold">{item.customer}</p><p className="mt-1 text-xs text-muted">{item.service} · última visita {formatDate(item.date)}</p></div><button type="button" onClick={() => onToast("Perfil do cliente demonstrativo.")} className="rounded-lg border border-[#e5e6e2] px-3 py-2 text-xs font-semibold">Ver perfil</button></div>)}</div></section>}
      {view === "notifications" && <section className="space-y-3">{["Seu horário está confirmado", "Novidades perto de você", "Avalie sua última experiência"].map((notice, index) => <article key={notice} className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft"><p className="text-xs text-muted">{index + 1} h atrás</p><h2 className="mt-2 font-bold">{notice}</h2><p className="mt-1 text-sm text-muted">Acompanhe novidades e informações importantes da sua conta EFAHub.</p></article>)}</section>}
      {view === "profile" && <section className="max-w-2xl rounded-2xl border border-[#e8e9e6] bg-white p-6 shadow-soft"><div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-full bg-[var(--accent-soft)] font-bold text-[var(--accent)]">JA</span><div><h2 className="font-bold">João Almeida</h2><p className="mt-1 text-sm text-muted">joao@email.com · perfil demonstrativo</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{["Dados pessoais", "Preferências de comunicação", "Privacidade e consentimento", "Ajuda e suporte"].map((item) => <button key={item} onClick={() => onToast(`${item}: configurações demonstrativas.`)} className="rounded-xl border border-[#e8e9e6] p-4 text-left text-sm font-semibold">{item}<ArrowRight className="float-right" size={16} /></button>)}</div></section>}
      {(view === "profile" || view === "settings") && <div className="mt-6"><ThemePreferencePanel preference={themePreference} resolvedTheme={resolvedTheme} onChange={onThemeChange} /></div>}
      {["team", "services", "finance", "marketing", "inventory", "settings", "earnings", "payments", "businesses", "subscriptions", "support", "audit"].includes(view) && <ModuleCards view={view} onToast={onToast} />}
      {isPlatform && view === "businesses" && <div className="mt-5 rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft"><PlatformBusinessTable onToast={onToast} /></div>}
      {isEmployee && view === "payments" && <div className="mt-5 grid gap-4 sm:grid-cols-3"><MetricCard label="A receber hoje" value="R$ 420" note="4 atendimentos" icon={CreditCard} /><MetricCard label="Recebido" value="R$ 1.280" note="8 lançamentos" icon={Check} /><MetricCard label="Pendências" value="4" note="última atualização local" icon={Clock3} /></div>}
    </>
  );
}

function ModuleCards({ view, onToast }: { view: ViewId; onToast: (message: string) => void }) {
  const entries: Record<string, [string, string, LucideIcon][]> = {
    team: [["Equipe ativa", "8 profissionais", Users], ["Comissões do mês", "R$ 6.840 em aberto", Wallet], ["Disponibilidade", "Jornadas e bloqueios", CalendarDays]],
    services: [["Catálogo ativo", "18 serviços publicados", Sparkles], ["Preço médio", "R$ 96,50", Wallet], ["Mais procurado", "Corte personalizado", Activity]],
    finance: [["Receita registrada", "R$ 42.680 no mês", Wallet], ["Despesas", "R$ 12.400 no mês", ArrowDownRight], ["Comissões", "R$ 6.840 pendentes", Users]],
    marketing: [["Campanhas ativas", "3 comunicações", Activity], ["Cupons disponíveis", "2 ofertas", Sparkles], ["Programa de fidelidade", "124 participantes", Heart]],
    inventory: [["Produtos cadastrados", "42 itens", Package], ["Estoque baixo", "3 alertas", Bell], ["Última movimentação", "Hoje às 09:14", Clock3]],
    settings: [["Dados da empresa", "Perfil e unidades", Store], ["Equipe e permissões", "Papéis e acessos", ShieldCheck], ["Horários e reservas", "Regras de atendimento", CalendarDays]],
    earnings: [["Comissão hoje", "R$ 204,00", Wallet], ["Comissão da semana", "R$ 1.090", Activity], ["Meta mensal", "72% concluída", ArrowUpRight]],
    payments: [["PIX", "Disponível para registro", CreditCard], ["Cartão", "Disponível para registro", CreditCard], ["Dinheiro", "Disponível para registro", Wallet]],
    businesses: [["Empresas ativas", "1.284 contas", Store], ["Em onboarding", "42 empresas", Users], ["Ações pendentes", "9 solicitações", Clock3]],
    subscriptions: [["Planos mensais", "1.012 assinaturas", CreditCard], ["Planos anuais", "272 assinaturas", CreditCard], ["Inadimplência", "2,1% das contas", Activity]],
    support: [["Abertos", "26 chamados", CircleHelp], ["Prioridade alta", "4 solicitações", Activity], ["Tempo médio", "3h 18min", Clock3]],
    audit: [["Eventos de hoje", "8.490 registros", Activity], ["Acessos suspeitos", "2 para revisão", ShieldCheck], ["Última sincronização", "Há 4 minutos", Clock3]]
  };
  const cards = entries[view] ?? [];
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([title, detail, Icon]) => <button key={title} onClick={() => onToast(`${title}: painel demonstrativo. Os dados reais dependem da integração do backend.`)} type="button" className="rounded-2xl border border-[#e8e9e6] bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-[#d3c4b4]"><span className="metric-icon"><Icon size={17} /></span><h2 className="mt-4 font-bold">{title}</h2><p className="mt-1 text-sm text-muted">{detail}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">Abrir módulo <ArrowRight size={13} /></span></button>)}</div>;
}

type DemoDateStatus = "available" | "full" | "blocked" | "past";

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDemoDateStatus(date: Date): DemoDateStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) return "past";
  if (date.getDate() % 13 === 0) return "blocked";
  if (date.getDate() % 9 === 0) return "full";
  return "available";
}

function BookingWizard({ onClose, onConfirm, initialStep = 0, onStepChange }: { onClose: () => void; onConfirm: (booking: Booking) => void; initialStep?: number; onStepChange: (step: number) => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
    focusable()[0]?.focus();
    function trapDialogFocus(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trapDialogFocus);
    return () => {
      document.removeEventListener("keydown", trapDialogFocus);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  const [step, setStep] = useState(initialStep);
  useEffect(() => setStep(initialStep), [initialStep]);
  const [business, setBusiness] = useState(businesses[0]);
  const [service, setService] = useState(services[0]);
  const [professional, setProfessional] = useState(professionals[0]);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [date, setDate] = useState(() => {
    const candidate = new Date();
    candidate.setDate(candidate.getDate() + 1);
    for (let attempt = 0; attempt < 14; attempt += 1) {
      if (getDemoDateStatus(candidate) === "available") return toDateValue(candidate);
      candidate.setDate(candidate.getDate() + 1);
    }
    return toDateValue(candidate);
  });
  const [time, setTime] = useState("10:30");
  const contactForm = useForm<BookingContact>({
    resolver: zodResolver(bookingContactSchema),
    defaultValues: { customer: "João Almeida", phone: "(11) 99999-9999" }
  });
  const steps = ["Empresa", "Serviço", "Profissional", "Data", "Horário", "Resumo"];
  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => toDateValue(new Date(year, month, index + 1)))];
  }, [visibleMonth]);
  const canContinue = step < 5;

  function confirm(contact: BookingContact) {
    onConfirm({ customer: contact.customer, business: business.name, service: service.name, professional: professional.name, date, time, price: service.price });
  }

  return (
    <div className="booking-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="booking-dialog rounded-3xl bg-white p-5 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.15em] text-[var(--accent)]">AGENDAMENTO ONLINE</p><h2 id="booking-title" className="mt-2 text-2xl font-bold">Reserve seu horário</h2></div><button type="button" onClick={onClose} aria-label="Fechar agendamento" className="grid size-9 place-items-center rounded-full bg-[#f3f3f0]"><X size={18} /></button></div>
        <div className="my-6 flex items-center gap-1 overflow-x-auto pb-2">{steps.map((label, index) => <div key={label} className="flex min-w-0 flex-1 items-center gap-2"><span className={`step-dot ${index === step ? "active" : index < step ? "done" : ""}`}>{index < step ? <Check size={14} /> : index + 1}</span><span className={`hidden text-xs font-semibold sm:block ${index === step ? "text-ink" : "text-muted"}`}>{label}</span>{index < steps.length - 1 && <span className="h-px min-w-3 flex-1 bg-[#e9eae7]" />}</div>)}</div>
        {step === 0 && <div><p className="mb-3 text-sm text-muted">Escolha onde deseja ser atendido.</p><div className="grid gap-3 sm:grid-cols-2">{businesses.map((item) => <button type="button" key={item.id} onClick={() => setBusiness(item)} className={`rounded-2xl border p-4 text-left ${business.id === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[#e8e9e6]"}`}><span className="flex items-center justify-between"><strong>{item.name}</strong><span className="flex items-center gap-1 text-xs"><Star className="fill-[#d6a64c] text-[#d6a64c]" size={13} />{item.rating}</span></span><span className="mt-2 block text-xs text-muted">{item.category} · {item.distance}</span><span className="mt-1 block text-xs text-muted">{item.location}</span></button>)}</div></div>}
        {step === 1 && <div><p className="mb-3 text-sm text-muted">Confira o valor e a duração do atendimento.</p><div className="grid gap-3 sm:grid-cols-2">{services.map((item) => <button type="button" key={item.id} onClick={() => setService(item)} className={`rounded-2xl border p-4 text-left ${service.id === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[#e8e9e6]"}`}><strong>{item.name}</strong><span className="mt-2 flex justify-between text-xs text-muted"><span>{item.duration}</span><b className="text-ink">{formatCurrency(item.price)}</b></span></button>)}</div></div>}
        {step === 2 && <div><p className="mb-3 text-sm text-muted">Escolha o profissional que vai atender você.</p><div className="grid gap-3 sm:grid-cols-2">{professionals.map((item) => <button type="button" key={item.id} onClick={() => setProfessional(item)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${professional.id === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[#e8e9e6]"}`}><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eeeafb] text-xs font-bold text-[var(--accent)]">{item.name.split(" ").map((part) => part[0]).join("")}</span><span><strong className="block text-sm">{item.name}</strong><small className="mt-1 block text-muted">{item.role} · {item.years}</small><small className="mt-1 flex items-center gap-1 text-muted"><Star className="fill-[#d6a64c] text-[#d6a64c]" size={12} />{item.rating}</small></span></button>)}</div></div>}
        {step === 3 && <div><p className="mb-3 text-sm text-muted">Selecione uma data para o atendimento.</p><div className="mb-4 flex items-center justify-between"><button type="button" aria-label="Mês anterior" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-9 place-items-center rounded-lg border border-[#e8e9e6]"><ChevronLeft size={17} /></button><strong className="capitalize">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(visibleMonth)}</strong><button type="button" aria-label="Próximo mês" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-9 place-items-center rounded-lg border border-[#e8e9e6]"><ChevronRight size={17} /></button></div><div className="grid grid-cols-7 gap-1.5 sm:gap-2">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={`${day}-${index}`} className="py-2 text-center text-[11px] font-semibold text-muted">{day}</span>)}{calendarDays.map((item, index) => { if (!item) return <span key={`empty-${index}`} />; const status = getDemoDateStatus(parseDateValue(item)); const unavailable = status !== "available"; const statusLabel = status === "available" ? "disponível" : status === "full" ? "esgotada" : status === "blocked" ? "bloqueada" : "passada"; return <button key={item} type="button" aria-label={`${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(parseDateValue(item))}, ${statusLabel}`} disabled={unavailable} title={`Data ${statusLabel}`} onClick={() => setDate(item)} className={`calendar-day min-h-12 !min-h-12 px-1 py-1 text-xs ${date === item ? "selected" : ""} ${unavailable ? "cursor-not-allowed opacity-45" : "hover:border-[var(--accent)]"}`}><strong className="text-sm">{parseDateValue(item).getDate()}</strong><span className={`mt-0.5 size-1.5 rounded-full ${status === "available" ? "bg-[#45866a]" : status === "full" ? "bg-[#d19b49]" : status === "blocked" ? "bg-[#c36d5f]" : "bg-transparent"}`} /></button>; })}</div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#45866a]" />Disponível</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#d19b49]" />Esgotada</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#c36d5f]" />Bloqueada</span></div><p className="mt-3 text-xs text-muted">Disponibilidade demonstrativa. A validação real deve ocorrer no servidor.</p></div>}
        {step === 4 && <div><p className="mb-4 text-sm text-muted">Horários livres para {formatDate(date)}.</p>{[{ label: "Manhã", times: ["09:00", "09:45", "10:30", "11:15"] }, { label: "Tarde", times: ["13:00", "14:00", "15:30", "16:15", "17:00"] }, { label: "Noite", times: ["18:30", "19:15", "20:00"] }].map((group) => <div key={group.label} className="mb-5 last:mb-0"><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{group.label}</h3><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{group.times.map((slot) => <button key={slot} type="button" onClick={() => setTime(slot)} className={`slot-button rounded-xl px-3 py-3 text-sm font-semibold ${time === slot ? "selected" : ""}`}>{slot}</button>)}</div></div>)}<p className="mt-3 text-xs text-muted">Somente horários livres são exibidos. A disponibilidade demonstrativa deve ser confirmada pelo servidor.</p></div>}
        {step === 5 && <div><p className="mb-4 text-sm text-muted">Revise os detalhes e confirme seus dados.</p><div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Nome completo<input {...contactForm.register("customer")} aria-invalid={Boolean(contactForm.formState.errors.customer)} className="mt-2 w-full rounded-xl border border-[#e5e6e2] px-3 py-3 text-sm font-normal" autoComplete="name" />{contactForm.formState.errors.customer && <span className="mt-1 block text-xs text-red-700">{contactForm.formState.errors.customer.message}</span>}</label><label className="text-xs font-semibold">Celular <span className="font-normal text-muted">(opcional)</span><input {...contactForm.register("phone")} aria-invalid={Boolean(contactForm.formState.errors.phone)} className="mt-2 w-full rounded-xl border border-[#e5e6e2] px-3 py-3 text-sm font-normal" type="tel" autoComplete="tel" placeholder="(11) 99999-9999" />{contactForm.formState.errors.phone && <span className="mt-1 block text-xs text-red-700">{contactForm.formState.errors.phone.message}</span>}</label></div><div className="rounded-2xl bg-[#f8f7f4] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted">EMPRESA</p><p className="mt-1 font-bold">{business.name}</p></div><button type="button" onClick={() => setStep(0)} className="text-xs font-semibold text-[var(--accent)]">Alterar</button></div><div className="my-4 border-t border-[#e5e3de]" /><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-muted">SERVIÇO</p><p className="mt-1 font-semibold">{service.name}</p><p className="mt-1 text-xs text-muted">{service.duration}</p></div><div><p className="text-xs text-muted">PROFISSIONAL</p><p className="mt-1 font-semibold">{professional.name}</p></div><div><p className="text-xs text-muted">DATA</p><p className="mt-1 font-semibold">{formatDate(date)}</p></div><div><p className="text-xs text-muted">HORÁRIO</p><p className="mt-1 font-semibold">{time}</p></div></div><div className="my-4 border-t border-[#e5e3de]" /><div className="flex justify-between"><span className="text-sm text-muted">Valor do serviço</span><strong>{formatCurrency(service.price)}</strong></div></div><p className="mt-4 text-xs leading-5 text-muted">Ao confirmar neste protótipo, a reserva aparece apenas nesta demonstração. Pagamentos, cancelamentos e confirmação real ainda não estão conectados.</p></div>}
        <div className="mt-7 flex justify-between gap-3 border-t border-[#eee] pt-5"><button type="button" disabled={step === 0} onClick={() => { const next = Math.max(0, step - 1); setStep(next); onStepChange(next); }} className="rounded-xl border border-[#e5e6e2] px-5 py-3 text-sm font-semibold disabled:opacity-40">Voltar</button>{canContinue ? <button type="button" onClick={() => { const next = step + 1; setStep(next); onStepChange(next); }} className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white">Continuar <ArrowRight className="ml-2 inline" size={15} /></button> : <button type="button" onClick={() => void contactForm.handleSubmit(confirm)()} className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white"><Check className="mr-2 inline" size={15} />Confirmar agendamento</button>}</div>
      </section>
    </div>
  );
}

export default function EfaHubApp({ initialRole = "businessAdmin", initialView = "home", initialBookingStep, initialBusinessId = "atelier" }: { initialRole?: Role; initialView?: ViewId; initialBookingStep?: number; initialBusinessId?: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [view, setView] = useState<ViewId>(initialView);
  const [appointments, setAppointments] = useState<Appointment[]>(makeInitialAppointments);
  const [bookingOpen, setBookingOpen] = useState(initialBookingStep !== undefined);
  const [businessId, setBusinessId] = useState(initialBusinessId);
  const [favoriteBusinessIds, setFavoriteBusinessIds] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [toast, setToast] = useState("");
  const [themePreference, setThemePreference] = useState<ThemePreference>("auto");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const currentNav = navigation[role];
  const activeLabel = currentNav.find((item) => item.id === view)?.label ?? currentNav[0].label;
  const todayLabel = useMemo(() => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), []);

  useEffect(() => {
    try {
      const savedPreference = normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
      setThemePreference(savedPreference ?? "auto");
    } catch (error) {
      console.error("Não foi possível carregar a preferência de aparência.", error);
      setToast("A aparência automática está ativa, mas a preferência não pôde ser carregada neste navegador.");
    } finally {
      setThemeReady(true);
    }
  }, []);

  useEffect(() => {
    const updateTheme = () => setResolvedTheme(resolveThemePreference(themePreference, new Date()));
    updateTheme();
    const timer = window.setInterval(updateTheme, 60_000);
    return () => window.clearInterval(timer);
  }, [themePreference]);

  useEffect(() => {
    if (!themeReady) return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    } catch (error) {
      console.error("Não foi possível salvar a preferência de aparência.", error);
      setToast("A aparência foi alterada, mas a preferência não pôde ser salva neste navegador.");
    }
  }, [themePreference, themeReady]);

  useEffect(() => {
    try {
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (storedFavorites) {
        const parsedFavorites: unknown = JSON.parse(storedFavorites);
        if (!Array.isArray(parsedFavorites) || !parsedFavorites.every((id): id is string => typeof id === "string")) {
          throw new Error("Formato de favoritos inválido.");
        }
        setFavoriteBusinessIds(parsedFavorites);
      }
    } catch (error) {
      console.error("Não foi possível carregar as empresas favoritas.", error);
      setToast("Os favoritos não puderam ser carregados neste navegador.");
    } finally {
      setFavoritesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritesReady) return;
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteBusinessIds));
    } catch (error) {
      console.error("Não foi possível salvar as empresas favoritas.", error);
      setToast("A alteração de favorito não pôde ser salva neste navegador.");
    }
  }, [favoriteBusinessIds, favoritesReady]);

  useEffect(() => {
    function syncThemePreference(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemePreference(normalizeThemePreference(event.newValue) ?? "auto");
    }
    window.addEventListener("storage", syncThemePreference);
    return () => window.removeEventListener("storage", syncThemePreference);
  }, []);

  useEffect(() => {
    setRole(initialRole);
    setView(initialView);
    setBookingOpen(initialBookingStep !== undefined);
    setBusinessId(initialBusinessId);
  }, [initialRole, initialView, initialBookingStep, initialBusinessId]);

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    setView("home");
    setBookingOpen(false);
    router.push(defaultRoute(nextRole));
  }

  function navigate(nextView: ViewId) {
    setView(nextView);
    setBookingOpen(false);
    router.push(viewRoute(role, nextView));
  }

  function navigateBusiness(nextBusinessId: string, servicesOnly = false) {
    const nextView: ViewId = servicesOnly ? "companyServices" : "business";
    setBusinessId(nextBusinessId);
    setView(nextView);
    setBookingOpen(false);
    router.push(`/cliente/empresa/${encodeURIComponent(nextBusinessId)}${servicesOnly ? "/servicos" : ""}`);
  }

  function toggleFavoriteBusiness(nextBusinessId: string) {
    const updatedFavorites = favoriteBusinessIds.includes(nextBusinessId)
      ? favoriteBusinessIds.filter((id) => id !== nextBusinessId)
      : [...favoriteBusinessIds, nextBusinessId];
    setFavoriteBusinessIds(updatedFavorites);
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updatedFavorites));
    } catch (error) {
      console.error("Não foi possível salvar as empresas favoritas.", error);
      showToast("A alteração de favorito não pôde ser salva neste navegador.");
    }
  }

  function navigateBookingStep(step: number) {
    if (role !== "client") return;
    const stepRoutes = ["empresa", "servicos", "profissional", "data", "horario", "confirmacao"];
    router.push(`/cliente/agendar/${stepRoutes[step]}`);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function addBooking(booking: Booking) {
    const newAppointment: Appointment = {
      id: Date.now(),
      customer: booking.customer,
      service: booking.service,
      professional: booking.professional,
      date: booking.date,
      time: booking.time,
      status: "Confirmado",
      price: booking.price
    };
    setAppointments((current) => [newAppointment, ...current]);
    setBookingOpen(false);
    showToast("Agendamento confirmado nesta demonstração.");
    if (role === "client") navigate("appointments");
    else navigate("agenda");
  }

  function completeAppointment(id: number) {
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, status: "Concluído" } : item));
    showToast("Atendimento marcado como concluído no protótipo.");
  }

  function quickCreateAppointment(appointment: Omit<Appointment, "id">) {
    setAppointments((current) => [{ ...appointment, id: Date.now() }, ...current]);
    showToast("Agendamento criado nesta demonstração.");
    navigate("agenda");
  }

  const contentProps: Props = { role, view, appointments, onBook: () => setBookingOpen(true), onToast: showToast, onComplete: completeAppointment, onQuickCreate: quickCreateAppointment, onNavigate: navigate, onViewBusiness: navigateBusiness, businessId, favoriteBusinessIds, onToggleFavorite: toggleFavoriteBusiness, themePreference, resolvedTheme, onThemeChange: setThemePreference };
  const dashboard = view === "home";

  return (
    <div className="workspace" data-role={role} data-theme={resolvedTheme}>
      {role !== "client" && <aside className="side-rail">
        <div className="rail-main">
          <Link href={defaultRoute(role)} className="rail-brand mb-8 flex items-center gap-2 px-2 text-xl font-extrabold tracking-tight text-ink no-underline"><span className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-white"><Sparkles size={18} /></span><span className="brand-copy">EFA<span className="font-medium text-[var(--accent)]">Hub</span></span></Link>
          <div className="rail-shop mb-7 flex items-center gap-3 rounded-xl border border-[#e8e9e6] px-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">{role === "platformAdmin" ? "EF" : "AA"}</span><span className="rail-shop-copy min-w-0 flex-1"><strong className="block truncate text-xs">{role === "platformAdmin" ? "EFAHub Global" : "Ateliê Aurora"}</strong><small className="mt-1 block text-[10px] text-muted">{role === "platformAdmin" ? "Console da plataforma" : "Plano profissional"}</small></span><ChevronDown className="rail-chevron text-muted" size={14} /></div>
          <p className="rail-section-label mb-2 px-3 text-[10px] font-bold tracking-[.14em] text-muted">{role === "platformAdmin" ? "PLATAFORMA" : role === "professional" ? "MEU TRABALHO" : role === "employee" ? "OPERAÇÃO" : "NEGÓCIO"}</p>
          <nav className="grid gap-1" aria-label="Navegação principal">{currentNav.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} title={label} aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)} className={`rail-nav-button flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${view === id ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[#62665f] hover:bg-[#f5f6f3]"}`}><Icon size={18} /><span className="nav-copy">{label}</span>{id === "agenda" && <span className="nav-copy ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] text-muted">{appointments.length}</span>}</button>)}</nav>
        </div>
        <button type="button" onClick={() => showToast("Ajuda e suporte demonstrativos.")} className="rail-footer flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-muted hover:bg-[#f5f6f3]"><CircleHelp size={18} /><span className="rail-footer-copy">Ajuda e suporte</span></button>
        <div className="mt-2 flex items-center gap-3 border-t border-[#ecece9] px-2 pt-4"><span className="grid size-9 place-items-center rounded-full bg-[#eeeafb] text-xs font-bold text-[var(--accent)]">{role === "platformAdmin" ? "EF" : role === "employee" ? "FC" : "MC"}</span><span className="rail-footer-copy min-w-0 flex-1"><strong className="block truncate text-xs">{role === "platformAdmin" ? "Equipe EFAHub" : role === "employee" ? "Fernanda Costa" : role === "professional" ? "Marina Costa" : "Marina Costa"}</strong><small className="mt-1 block text-[10px] text-muted">{roleOptions.find((item) => item.id === role)?.label}</small></span><button aria-label="Sair" type="button" onClick={() => showToast("Sessão demonstrativa.")}><LogOut size={16} className="text-muted" /></button></div>
      </aside>}
      <div className="content-area">
        {role === "client" ? <header className="flex items-center justify-between border-b border-[#ebe8e3] bg-white px-5 py-3 sm:px-8"><Link href={defaultRoute(role)} className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink no-underline"><span className="grid size-8 place-items-center rounded-lg bg-[var(--accent)] text-white"><Sparkles size={16} /></span>EFA<span className="font-medium text-[var(--accent)]">Hub</span></Link><div className="flex items-center gap-2 sm:gap-3"><select className="role-select rounded-xl border border-[#e7e5df] bg-white px-3 py-2 text-xs font-semibold" aria-label="Trocar perfil demonstrativo" value={role} onChange={(event) => changeRole(event.target.value as Role)}>{roleOptions.map((option) => <option value={option.id} key={option.id}>Demo: {option.label}</option>)}</select><ThemeCycleButton preference={themePreference} onChange={setThemePreference} /><button type="button" aria-label="Notificações" onClick={() => navigate("notifications")} className="grid size-9 place-items-center rounded-full bg-[#f0eafa] text-ink"><Bell size={17} /></button><span className="hidden size-9 place-items-center rounded-full bg-[#eeeafb] text-xs font-bold text-[var(--accent)] sm:grid">JA</span></div></header> : <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-[#e8e9e6] bg-white px-5 sm:px-8"><div className="flex items-center gap-3"><div className="text-xs text-muted"><span>{role === "platformAdmin" ? "EFAHub" : "Ateliê Aurora"}</span><span className="mx-2">/</span><strong className="font-semibold text-ink">{activeLabel}</strong></div></div><div className="flex items-center gap-2 sm:gap-4"><span className="hidden text-xs capitalize text-muted md:block">{todayLabel}</span><label className="hidden items-center gap-2 rounded-lg border border-[#e8e9e6] px-3 py-2 lg:flex"><Search size={15} className="text-muted" /><input className="w-28 bg-transparent text-xs outline-none placeholder:text-muted" placeholder="Buscar..." aria-label="Buscar" onKeyDown={(event) => { if (event.key === "Enter") showToast("Busca demonstrativa."); }} /><kbd className="rounded bg-[#f3f4f1] px-1.5 py-0.5 text-[10px] text-muted">⌘ K</kbd></label><ThemeCycleButton preference={themePreference} onChange={setThemePreference} /><button type="button" onClick={() => showToast("Sem notificações novas.")} aria-label="Notificações" className="relative grid size-9 place-items-center rounded-lg border border-[#e8e9e6] text-muted"><Bell size={17} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#cf765e]" /></button><select className="role-select max-w-[190px] rounded-xl border border-[#e7e5df] bg-white px-3 py-2 text-xs font-semibold" aria-label="Trocar perfil demonstrativo" value={role} onChange={(event) => changeRole(event.target.value as Role)}>{roleOptions.map((option) => <option value={option.id} key={option.id}>Demo: {option.label}</option>)}</select><button type="button" aria-label="Mais opções" onClick={() => showToast("Menu da conta demonstrativa.")} className="hidden text-muted sm:block"><MoreHorizontal size={20} /></button></div></header>}
        {role === "client" && <nav className="client-top-nav" aria-label="Navegação do cliente">{navigation.client.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)}><Icon size={16} /><span>{label}</span></button>)}</nav>}
        <main className={role === "client" ? "client-content" : "page-content"}>
          {role === "client" ? view === "home" ? <ClientHome {...contentProps} /> : <ModuleView {...contentProps} /> :
            dashboard && role === "businessAdmin" ? <BusinessDashboard {...contentProps} /> :
            dashboard && role === "professional" ? <ProfessionalDashboard {...contentProps} /> :
            dashboard && role === "employee" ? <EmployeeDashboard {...contentProps} /> :
            dashboard && role === "platformAdmin" ? <PlatformDashboard {...contentProps} /> :
            <ModuleView {...contentProps} />}
        </main>
      </div>
      <nav className="client-bottom-nav justify-around" aria-label={`Navegação: ${roleOptions.find((item) => item.id === role)?.label}`}>{currentNav.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)} className={`flex flex-col items-center gap-1 px-2 py-1 text-[10px] ${view === id ? "font-bold text-[var(--accent)]" : "text-muted"}`}><Icon size={19} /><span>{label}</span></button>)}</nav>
      {bookingOpen && <BookingWizard initialStep={initialBookingStep} onClose={() => { setBookingOpen(false); navigate("home"); }} onStepChange={navigateBookingStep} onConfirm={addBooking} />}
      {toast && <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-2xl sm:bottom-6"><Check size={16} className="text-[#8fc8a8]" />{toast}<button type="button" aria-label="Fechar aviso" className="ml-2 text-white/70" onClick={() => setToast("")}><X size={15} /></button></div>}
    </div>
  );
}
