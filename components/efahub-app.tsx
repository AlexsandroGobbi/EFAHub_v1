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
  Tag,
  Store,
  UserRound,
  Users,
  Wallet,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
const APPOINTMENTS_SESSION_KEY = "efahub-demo-appointments-v1";
const COUPONS_SESSION_KEY = "efahub-demo-coupons-v1";
const BOOKING_RULES_SESSION_KEY = "efahub-demo-booking-rules-v1";
const TEAM_SESSION_PREFIX = "efahub-demo-team-v1:";

export type ViewId =
  | "home" | "search" | "business" | "companyServices" | "appointments" | "favorites" | "notifications" | "profile"
  | "agenda" | "clients" | "earnings" | "checkin" | "payments"
  | "newBooking" | "newClient" | "reports"
  | "team" | "services" | "finance" | "marketing" | "inventory" | "settings"
  | "businesses" | "subscriptions" | "support" | "audit";

type NavEntry = { id: ViewId; label: string; icon: LucideIcon };
type BookingOptions = { businessId?: string; serviceId?: string; step?: number };
type CashMethod = "PIX" | "Cartão" | "Dinheiro";
type CommissionRule = { type: "percent" | "fixed"; value: number; release: "afterCompletion" | "afterPayment"; methods: CashMethod[] };
type BookingRules = {
  checkInEnabled: boolean;
  checkInLeadHours: number;
  cancelLeadHours: number;
  rescheduleLeadHours: number;
  lateThresholdMinutes: number;
  lateProfessionalAction: "notifyClient" | "reschedule";
  absentProfessionalAction: "notifyClient" | "automaticReschedule" | "contactClient";
  commissionRules: Record<string, CommissionRule>;
};
type DemoCoupon = { id: number; code: string; kind: "percent" | "fixed"; value: number; expiry: string; maxUses: number; usedCount: number; service: string; campaign: string };
const initialDemoCoupons: DemoCoupon[] = [
  { id: 1, code: "EFA10", kind: "percent", value: 10, expiry: "2027-12-31", maxUses: 100, usedCount: 0, service: "Todos os serviços", campaign: "Boas-vindas" },
  { id: 2, code: "BEMVINDO15", kind: "fixed", value: 15, expiry: "2027-06-30", maxUses: 50, usedCount: 0, service: "Corte personalizado", campaign: "Primeira visita" }
];
const appointmentStateSchema = z.array(z.object({
  id: z.number(),
  customer: z.string(),
  business: z.string().optional(),
  service: z.string(),
  professional: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(["Confirmado", "Aguardando", "Concluído", "Cancelado"]),
  price: z.number().nonnegative(),
  presenceConfirmed: z.boolean().optional(),
  paymentStatus: z.enum(["pending", "received"]).optional(),
  paymentMethod: z.enum(["PIX", "Cartão", "Dinheiro"]).optional()
}));
const couponStateSchema = z.array(z.object({
  id: z.number(),
  code: z.string(),
  kind: z.enum(["percent", "fixed"]),
  value: z.number().nonnegative(),
  expiry: z.string(),
  maxUses: z.number().int().positive(),
  usedCount: z.number().int().nonnegative(),
  service: z.string(),
  campaign: z.string()
}));
const commissionRuleSchema = z.object({
  type: z.enum(["percent", "fixed"]),
  value: z.number().nonnegative(),
  release: z.enum(["afterCompletion", "afterPayment"]),
  methods: z.array(z.enum(["PIX", "Cartão", "Dinheiro"])).min(1)
});
const bookingRulesStateSchema = z.object({
  checkInEnabled: z.boolean(),
  checkInLeadHours: z.number().min(0).max(168),
  cancelLeadHours: z.number().min(0).max(168),
  rescheduleLeadHours: z.number().min(0).max(168),
  lateThresholdMinutes: z.number().int().min(0).max(180),
  lateProfessionalAction: z.enum(["notifyClient", "reschedule"]),
  absentProfessionalAction: z.enum(["notifyClient", "automaticReschedule", "contactClient"]),
  commissionRules: z.record(z.string(), commissionRuleSchema)
});
const teamStateSchema = z.array(z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["Recepcionista", "Profissional"]),
  status: z.enum(["Ativo", "Convite pendente"])
}));
const subscriptionStateSchema = z.object({
  cycle: z.string(),
  cancelAtEnd: z.boolean(),
  access: z.enum(["Ativo", "Parcialmente limitado", "Suspenso"]),
  retryCount: z.number().int().nonnegative()
});
type Props = { role: Role; view: ViewId; appointments: Appointment[]; onBook: (options?: BookingOptions) => void; onToast: (message: string) => void; onComplete: (id: number) => void; onMarkPayment: (id: number, method: CashMethod) => void; onQuickCreate: (appointment: Omit<Appointment, "id">) => void; onNavigate: (view: ViewId) => void; onViewBusiness: (businessId: string, servicesOnly?: boolean) => void; businessId: string; favoriteBusinessIds: string[]; onToggleFavorite: (businessId: string) => void; themePreference: ThemePreference; resolvedTheme: ResolvedTheme; onThemeChange: (preference: ThemePreference) => void; onCancelAppointment: (id: number) => void; onConfirmPresence: (id: number) => void; onRescheduleAppointment: (appointment: Appointment) => void; bookingRules: BookingRules; onBookingRulesChange: (rules: BookingRules) => void; coupons: DemoCoupon[]; onCouponsChange: (coupons: DemoCoupon[]) => void };
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
    { id: "payments", label: "Caixa", icon: Wallet }
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
    { id: "subscriptions", label: "Assinaturas EFAHub", icon: CreditCard },
    { id: "finance", label: "Financeiro EFAHub", icon: Wallet },
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
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#e6c6ce] bg-[#fbf0f3] px-4 py-3 text-xs leading-5 text-[#642033]">
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

function AppointmentList({ items, showActions = false, onComplete, onCancel, onReschedule, onToast }: { items: Appointment[]; showActions?: boolean; onComplete?: (id: number) => void; onCancel?: (id: number) => void; onReschedule?: (appointment: Appointment) => void; onToast: (message: string) => void }) {
  if (!items.length) return <div className="rounded-xl border border-dashed border-[#dfe1dc] px-5 py-10 text-center text-sm text-muted">Nenhum agendamento neste período.</div>;
  return (
    <div className="divide-y divide-[#eff0ed]">
      {items.map((item) => {
        const canComplete = new Date(`${item.date}T${item.time}:00`).getTime() <= Date.now();
        return (
        <div className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0" key={item.id}>
          <div className="min-w-[66px] rounded-xl bg-[#f4f4f1] px-3 py-2 text-center"><span className="block text-xs text-muted">{formatDate(item.date)}</span><strong className="mt-1 block text-sm">{item.time}</strong></div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.customer}</p><p className="mt-1 text-xs text-muted">{item.service} <span className="px-1">·</span> {item.professional}</p></div>
          <div className="ml-auto flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === "Concluído" ? "bg-[#e7f2eb] text-[#217a5b]" : item.status === "Aguardando" ? "bg-[#fff3df] text-[#8b6221]" : "bg-[#eef0f3] text-[#536170]"}`}>{item.status}</span><span className="hidden text-sm font-semibold sm:block">{formatCurrency(item.price)}</span></div>
          {showActions && <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto"><button type="button" className="rounded-lg border border-[#e4e5e1] px-3 py-2 text-xs font-semibold hover:bg-[#f7f7f5]" onClick={() => onToast(`Detalhes de ${item.customer}`)}>Ver detalhes</button>{item.status !== "Concluído" && item.status !== "Cancelado" && <><button type="button" className="rounded-lg border border-[#e4e5e1] px-3 py-2 text-xs font-semibold" onClick={() => onReschedule?.(item)}>Alterar</button><button type="button" className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" onClick={() => onCancel?.(item.id)}>Cancelar</button><button type="button" disabled={!canComplete} title={canComplete ? "Finalizar atendimento" : "O atendimento só pode ser finalizado no horário marcado"} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onComplete?.(item.id)}>Finalizar</button></>}</div>}
        </div>
        );
      })}
    </div>
  );
}

function BusinessCards({ onBook, onViewBusiness, favoriteBusinessIds, onToggleFavorite, items = businesses }: { onBook: () => void; onViewBusiness: (businessId: string, servicesOnly?: boolean) => void; favoriteBusinessIds: string[]; onToggleFavorite: (businessId: string) => void; items?: typeof businesses }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((business, index) => (
        <article className="overflow-hidden rounded-2xl border border-[#ebe8e3] bg-white shadow-soft" key={business.id}>
          <div className={`flex h-32 items-end p-4 ${index === 0 ? "bg-gradient-to-br from-[#d7aab5] to-[#f7e9ed]" : index === 1 ? "bg-gradient-to-br from-[#bd7d8c] to-[#f7e9ed]" : "bg-gradient-to-br from-[#cdb5bb] to-[#f8eef0]"}`}>
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

function ClientHome({ appointments, onBook, businessId }: Props) {
  const next = appointments.find((appointment) => appointment.customer === "João Almeida" && appointment.status !== "Concluído" && appointment.status !== "Cancelado");
  const business = businesses.find((item) => item.id === businessId) ?? businesses[0];
  return (
    <>
      <section className="mb-7 flex flex-wrap items-center gap-4 rounded-3xl border border-[#ead8dd] bg-white p-5 shadow-soft sm:p-7">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-xl font-extrabold text-[var(--accent)]" aria-label={`Logo ${business.name}`}>{business.image}</span>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold tracking-[.14em] text-[var(--accent)]">BEM-VINDA AO</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{business.name}</h1><p className="mt-1 text-sm text-muted">Olá, João! Escolha um serviço e agende diretamente com a equipe.</p></div>
        <button type="button" onClick={() => onBook({ businessId: business.id, step: 1 })} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white"><Plus className="mr-2 inline" size={16} />Encontrar horário</button>
      </section>
      <div className="mb-8"><SectionHeading title="Serviços disponíveis" detail={`Escolha um serviço de ${business.name}. O pagamento é feito no estabelecimento.`} /><div className="client-service-grid">{services.map((service) => <button key={service.id} type="button" onClick={() => onBook({ businessId: business.id, serviceId: service.id, step: 2 })} className="rounded-2xl border border-[#ebe8e3] bg-white p-4 text-left shadow-soft transition hover:border-[var(--accent)]"><span className="flex items-start justify-between gap-3"><strong>{service.name}</strong><ArrowRight className="shrink-0 text-[var(--accent)]" size={17} /></span><span className="mt-3 flex justify-between text-sm text-muted"><span>{service.duration}</span><strong className="text-ink">{formatCurrency(service.price)}</strong></span></button>)}</div></div>
      <section className="mb-8 rounded-2xl border border-[#ebe8e3] bg-white p-5 shadow-soft"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold tracking-wider text-[var(--accent)]">SEU PRÓXIMO AGENDAMENTO</p><h2 className="mt-2 font-bold">{next?.service ?? "Seu próximo cuidado"}</h2></div><CalendarDays className="text-[var(--accent)]" size={21} /></div>{next ? <div className="mt-4 rounded-xl bg-[#f7e9ed] p-4"><p className="font-semibold">{business.name}</p><p className="mt-1 text-sm text-muted">{next.professional} · {formatDate(next.date)} às {next.time}</p><p className="mt-2 text-sm font-semibold">{formatCurrency(next.price)}</p></div> : <p className="mt-4 text-sm text-muted">Você ainda não tem agendamentos marcados.</p>}</section>
      <div className="grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-[#ebe8e3] bg-white p-5 shadow-soft"><SectionHeading title="Novidades para você" detail="Informações e vantagens da comunidade" /><div className="space-y-3"><div className="client-promo-card rounded-xl bg-[#fbf0f3] p-4"><p className="client-promo-label text-xs font-bold tracking-wider text-[#7a2438]">BEM-VINDA DE VOLTA</p><p className="mt-2 text-sm font-semibold">Seu próximo momento de autocuidado está esperando.</p></div><div className="client-promo-card rounded-xl bg-[#f7e9ed] p-4"><p className="client-promo-label text-xs font-bold tracking-wider text-[#642033]">DICA EFAHUB</p><p className="mt-2 text-sm font-semibold">Fale com {business.name} se precisar de ajuda com seu atendimento.</p></div></div></section><section className="rounded-2xl border border-[#ebe8e3] bg-white p-5 shadow-soft"><SectionHeading title="Agendamentos rápidos" detail="Continue de onde parou" /><button type="button" onClick={() => onBook({ businessId: business.id, step: 1 })} className="w-full rounded-xl border border-[#ead8dd] p-4 text-left text-sm font-semibold hover:bg-[#fbf0f3]">Ver horários de {business.name}<ArrowRight className="float-right text-[var(--accent)]" size={16} /></button></section></div>
    </>
  );
}

function BusinessDashboard({ appointments, onToast, onComplete, onCancelAppointment, onRescheduleAppointment, onNavigate }: Props) {
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
      <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Próximos atendimentos" detail="Agenda da unidade · hoje" action="Abrir agenda" onAction={() => onNavigate("agenda")} /><AppointmentList items={appointments} showActions onComplete={onComplete} onCancel={onCancelAppointment} onReschedule={onRescheduleAppointment} onToast={onToast} /></section>
      <div className="mt-6 grid gap-5 md:grid-cols-2"><InsightCard title="Oportunidade de recorrência" text="18 clientes habituais estão próximos do período médio de retorno." label="CRM" /><InsightCard title="Horários com maior procura" text="Quinta-feira, entre 16h e 19h, concentra mais solicitações." label="AGENDA" /></div>
    </>
  );
}

function ProfessionalDashboard({ appointments, onToast, onComplete, onCancelAppointment, onRescheduleAppointment, onNavigate }: Props) {
  const todayAppointments = appointments.slice(0, 3);
  return (
    <>
      <DemoNotice />
      <div className="mb-7"><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">QUINTA-FEIRA · 6 DE NOVEMBRO</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{roleTitles.professional}</h1><p className="mt-2 text-sm text-muted">Aqui está o que importa para o seu dia.</p></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Atendimentos hoje" value="6" note="2 concluídos · 4 pela frente" icon={CalendarDays} /><MetricCard label="Receita gerada" value="R$ 680" note="comissões calculadas no demo" icon={Wallet} trend="+8%" /><MetricCard label="Próximo cliente" value="Beatriz" note="Coloração · 10:30" icon={Clock3} /><MetricCard label="Avaliação média" value="4,9" note="últimos atendimentos" icon={Star} trend="+0,2" /></div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Minha agenda" detail="Seus atendimentos de hoje" action="Ver semana" onAction={() => onNavigate("agenda")} /><AppointmentList items={todayAppointments} showActions onComplete={onComplete} onCancel={onCancelAppointment} onReschedule={onRescheduleAppointment} onToast={onToast} /></section><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Resumo de ganhos" detail="Comissões estimadas" /><div className="rounded-xl bg-[#f7f6f2] p-4"><p className="text-xs text-muted">Hoje</p><p className="mt-1 text-2xl font-bold">R$ 204,00</p><p className="mt-1 text-xs text-muted">Semana: R$ 1.090,00</p></div><div className="mt-4 space-y-3"><Progress label="Meta do mês" value="R$ 3.240 de R$ 4.500" percent={72} /><p className="text-xs leading-5 text-muted">Os valores são demonstrativos e não representam pagamentos ou fechamento real de comissão.</p></div><button onClick={() => onNavigate("earnings")} type="button" className="mt-4 w-full rounded-xl border border-[#e5e6e2] py-2.5 text-sm font-semibold">Ver extrato</button></section></div>
      <div className="mt-6 grid gap-5 md:grid-cols-2"><InsightCard title="Cliente em destaque" text="João Almeida prefere horários pela manhã e corte tradicional." label="PERFIL DO CLIENTE" /><InsightCard title="Lembrete de atendimento" text="Confira as observações do próximo cliente antes de iniciar." label="PRÓXIMA AÇÃO" /></div>
    </>
  );
}

function EmployeeDashboard({ appointments, onToast, onComplete, onCancelAppointment, onRescheduleAppointment, onNavigate }: Props) {
  const quickActions: { title: string; detail: string; view: ViewId }[] = [
    { title: "Confirmar chegada", detail: "Registrar check-in do cliente", view: "checkin" },
    { title: "Novo cliente", detail: "Cadastrar contato e preferências", view: "newClient" },
    { title: "Registrar recebimento presencial", detail: "Anotar um pagamento já feito no estabelecimento", view: "payments" },
    { title: "Registrar venda", detail: "Lançar venda e recebimento feito no estabelecimento", view: "payments" }
  ];
  return (
    <>
      <DemoNotice />
      <div className="mb-7"><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">RECEPÇÃO · UNIDADE JARDINS</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{roleTitles.employee}</h1><p className="mt-2 text-sm text-muted">Resumo operacional para manter o atendimento fluindo.</p></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Aguardando chegada" value="3" note="1 cliente já chegou" icon={Users} /><MetricCard label="Agendamentos hoje" value={`${appointments.length + 12}`} note="em 3 profissionais" icon={CalendarDays} /><MetricCard label="Check-ins" value="8" note="2 nos próximos 30 min" icon={Check} /><MetricCard label="Aguardando pagamento no local" value="R$ 420" note="4 atendimentos" icon={Clock3} /></div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Fila de atendimento" detail="Acompanhe a chegada dos clientes" action="Abrir agenda" onAction={() => onNavigate("agenda")} /><AppointmentList items={appointments} showActions onComplete={onComplete} onCancel={onCancelAppointment} onReschedule={onRescheduleAppointment} onToast={onToast} /></section><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Ações rápidas" detail="Rotina da recepção" /><div className="grid gap-3">{quickActions.map(({ title, detail, view }) => <button type="button" onClick={() => onNavigate(view)} key={title} className="flex items-center justify-between rounded-xl border border-[#ecece9] p-4 text-left hover:bg-[#fafaf8]"><span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs text-muted">{detail}</span></span><ArrowRight size={16} className="text-muted" /></button>)}</div></section></div>
    </>
  );
}

function PlatformDashboard({ onToast, onNavigate, appointments, onComplete, onCancelAppointment, onRescheduleAppointment }: Props) {
  return (
    <>
      <DemoNotice />
      <div className="mb-7"><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">OPERAÇÃO DA PLATAFORMA</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{roleTitles.platformAdmin}</h1><p className="mt-2 text-sm text-muted">Acompanhe a saúde do ecossistema EFAHub.</p></div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Empresas ativas" value="1.284" note="em todos os planos" icon={Store} trend="+9,4%" accent /><MetricCard label="MRR" value="R$ 184,6 mil" note="receita recorrente mensal" icon={Wallet} trend="+6,8%" /><MetricCard label="Agendamentos" value="48.291" note="nos últimos 30 dias" icon={CalendarDays} trend="+14,2%" /><MetricCard label="Tickets abertos" value="26" note="4 com prioridade alta" icon={CircleHelp} /></div>
      <div className="mb-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Crescimento da plataforma" detail="MRR ilustrativo · últimos 6 meses" /><RevenueChart /></section><section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Saúde do ecossistema" detail="Indicadores operacionais" /><div className="space-y-5"><Progress label="Empresas com onboarding concluído" value="86% da base" percent={86} /><Progress label="Retenção de empresas" value="94,2% · 30 dias" percent={94} /><Progress label="SLA de suporte" value="91% dentro do prazo" percent={91} /><div className="flex items-center justify-between border-t border-[#eee] pt-4 text-sm"><span className="text-muted">Churn mensal</span><strong>2,4%</strong></div></div></section></div>
      <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Empresas para acompanhar" detail="Visão demonstrativa de contas e suporte" action="Abrir empresas" onAction={() => onNavigate("businesses")} /><PlatformBusinessTable onToast={onToast} appointments={appointments} onComplete={onComplete} onCancelAppointment={onCancelAppointment} onRescheduleAppointment={onRescheduleAppointment} /></section>
    </>
  );
}

function RevenueChart() {
  const points = [34, 48, 42, 63, 54, 72, 65, 86, 74, 91, 82, 98];
  return <div className="pt-4"><div className="flex h-48 items-end gap-2 border-b border-l border-[#eee] px-2 pb-0 sm:gap-4">{points.map((height, index) => <div key={index} className="group relative flex h-full flex-1 items-end"><span className="w-full rounded-t-md bg-gradient-to-t from-[#7a2438] to-[#ad5368] transition hover:opacity-80" style={{ height: `${height}%` }} title={`Período ${index + 1}`} /></div>)}</div><div className="mt-3 flex justify-between text-[11px] text-muted"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div><p className="mt-4 flex items-center gap-2 text-xs text-muted"><span className="size-2 rounded-full bg-[#7a2438]" />Receita registrada · valores ilustrativos</p></div>;
}

function Progress({ label, value, percent }: { label: string; value: string; percent: number }) {
  return <div><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="text-muted">{label}</span><strong>{value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#eff0ed]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} /></div></div>;
}

function InsightCard({ title, text, label }: { title: string; text: string; label: string }) {
  return <article className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft"><p className="text-[10px] font-bold tracking-[.14em] text-[var(--accent)]">{label}</p><h3 className="mt-2 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{text}</p></article>;
}

function PlatformBusinessTable({ onToast, appointments, onComplete, onCancelAppointment, onRescheduleAppointment }: { onToast: (message: string) => void; appointments: Appointment[]; onComplete: (id: number) => void; onCancelAppointment: (id: number) => void; onRescheduleAppointment: (appointment: Appointment) => void }) {
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  return <><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-[10px] tracking-wider text-muted"><tr><th className="pb-3 font-semibold">EMPRESA</th><th className="pb-3 font-semibold">PLANO</th><th className="pb-3 font-semibold">STATUS</th><th className="pb-3 font-semibold">MRR</th><th className="pb-3 font-semibold">AÇÃO</th></tr></thead><tbody className="divide-y divide-[#eee]">{[["Ateliê Aurora", "Pro", "Ativa", "R$ 189"], ["Barbearia Central", "Essencial", "Ativa", "R$ 99"], ["Casa Serena", "Pro", "Em análise", "R$ 189"]].map((row) => <tr key={row[0]}><td className="py-4 font-semibold">{row[0]}</td><td className="py-4 text-muted">{row[1]}</td><td className="py-4"><span className="rounded-full bg-[#e8f2eb] px-2.5 py-1 text-xs font-semibold text-success">{row[2]}</span></td><td className="py-4">{row[3]}</td><td className="py-4"><button type="button" onClick={() => setSelectedBusiness((current) => current === row[0] ? null : row[0])} className="rounded-lg border border-[#e5e6e2] px-3 py-1.5 text-xs font-semibold">{selectedBusiness === row[0] ? "Fechar detalhes" : "Gerenciar"}</button></td></tr>)}</tbody></table></div>{selectedBusiness && <><TeamManagementPanel key={selectedBusiness} businessName={selectedBusiness} onToast={onToast} /><section className="mt-5 rounded-2xl border border-[#e8e9e6] bg-white p-5"><h2 className="font-bold">Agendamentos · {selectedBusiness}</h2><p className="mt-1 text-sm text-muted">Administração EFAHub: ações demonstrativas dentro da empresa selecionada.</p><div className="mt-4"><AppointmentList items={appointments.filter((item) => (item.business ?? businesses[0].name) === selectedBusiness && item.status !== "Cancelado" && item.status !== "Concluído")} showActions onComplete={onComplete} onCancel={onCancelAppointment} onReschedule={onRescheduleAppointment} onToast={onToast} /></div></section></>}</>;
}

function ClientProfile({ onToast }: { onToast: (message: string) => void }) {
  const [tab, setTab] = useState("personal");
  const [channels, setChannels] = useState({ email: true, sms: false, whatsapp: true, push: true });
  const tabs = [
    { id: "personal", label: "Dados pessoais" },
    { id: "communication", label: "Comunicação" },
    { id: "privacy", label: "Privacidade" },
    { id: "help", label: "Ajuda e suporte" }
  ];
  const fieldClass = "mt-2 w-full rounded-xl border border-[#e5e6e2] bg-white px-3 py-3 text-sm";
  const labelClass = "text-xs font-semibold";

  return <section className="max-w-3xl rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6">
    <div className="mb-5 rounded-xl border border-[#e6c6ce] bg-[#fbf0f3] p-4 text-sm leading-6 text-[#642033]"><strong>Perfil demonstrativo.</strong> Não informe CPF, endereço ou outros dados reais. Alterações não são salvas em um servidor.</div>
    <div className="profile-tab-list mb-5" role="tablist" aria-label="Seções do perfil">
      {tabs.map((item) => <button key={item.id} id={`profile-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`profile-panel-${item.id}`} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </div>
    {tab === "personal" && <form id="profile-panel-personal" role="tabpanel" aria-labelledby="profile-tab-personal" onSubmit={(event) => { event.preventDefault(); onToast("Dados demonstrativos; nenhuma informação foi enviada ou salva."); }} className="grid gap-4 sm:grid-cols-2">
      <label className={`${labelClass} sm:col-span-2`}>Nome completo<input className={fieldClass} autoComplete="name" placeholder="Seu nome completo" /></label>
      <label className={labelClass}>CPF<input className={fieldClass} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" /></label>
      <label className={labelClass}>Data de nascimento<input className={fieldClass} type="date" autoComplete="bday" /></label>
      <label className={labelClass}>E-mail<input className={fieldClass} type="email" autoComplete="email" placeholder="voce@email.com" /></label>
      <label className={labelClass}>Telefone<input className={fieldClass} type="tel" autoComplete="tel" placeholder="(00) 00000-0000" /></label>
      <label className={`${labelClass} sm:col-span-2`}>Endereço<input className={fieldClass} autoComplete="street-address" placeholder="Rua, número, bairro, cidade" /></label>
      <button className="w-fit rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white sm:col-span-2" type="submit">Salvar dados</button>
    </form>}
    {tab === "communication" && <div id="profile-panel-communication" role="tabpanel" aria-labelledby="profile-tab-communication" className="space-y-3">
      <p className="mb-4 text-sm text-muted">Escolha por quais canais aceita receber mensagens. Preferências não são salvas neste protótipo.</p>
      {Object.entries({ email: "E-mail", sms: "SMS", whatsapp: "WhatsApp", push: "Notificações push" }).map(([id, label]) => <label key={id} className="flex items-center justify-between rounded-xl border border-[#e8e9e6] p-4 text-sm font-semibold">{label}<input type="checkbox" checked={channels[id as keyof typeof channels]} onChange={(event) => setChannels((current) => ({ ...current, [id]: event.target.checked }))} aria-label={`Receber comunicações por ${label}`} /></label>)}
    </div>}
    {tab === "privacy" && <div id="profile-panel-privacy" role="tabpanel" aria-labelledby="profile-tab-privacy" className="space-y-4">
      <h2 className="font-bold">Privacidade e consentimento</h2>
      <label className="flex gap-3 rounded-xl border border-[#e8e9e6] p-4 text-sm"><input type="checkbox" />Li o aviso de privacidade e concordo com o uso necessário dos dados para gerenciar meus agendamentos.</label>
      <label className="flex gap-3 rounded-xl border border-[#e8e9e6] p-4 text-sm"><input type="checkbox" />Aceito receber novidades e ofertas. Este consentimento é opcional.</label>
      <div className="rounded-xl bg-[#f7f7f5] p-4"><h3 className="text-sm font-bold">Histórico de consentimentos</h3><p className="mt-2 text-sm text-muted">Nenhum consentimento real foi registrado. O histórico será disponibilizado quando a conta estiver conectada ao sistema.</p></div>
      <div className="rounded-xl border border-[#e8e9e6] p-4"><h3 className="text-sm font-bold">Retenção dos dados</h3><p className="mt-2 text-sm leading-6 text-muted">Dados pessoais e históricos operacionais poderão ser mantidos por até 10 anos para obrigações legais, auditoria, segurança e histórico de atendimento. Após esse prazo, poderão ser anonimizados ou excluídos conforme a política de privacidade vigente. Esta tela é demonstrativa e não representa armazenamento real.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onToast("A solicitação de dados será conectada ao backend.")} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Solicitar meus dados</button><button type="button" onClick={() => onToast("A exclusão de dados requer autenticação e processamento seguro.")} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Solicitar exclusão</button></div>
    </div>}
    {tab === "help" && <div id="profile-panel-help" role="tabpanel" aria-labelledby="profile-tab-help" className="space-y-3">
      <h2 className="mb-3 font-bold">Perguntas frequentes</h2>
      <details className="rounded-xl border border-[#e8e9e6] p-4"><summary className="cursor-pointer text-sm font-semibold">Como cancelo ou altero um agendamento?</summary><p className="mt-3 text-sm text-muted">Abra “Agendamentos” e escolha cancelar ou reagendar, respeitando as regras da empresa.</p></details>
      <details className="rounded-xl border border-[#e8e9e6] p-4"><summary className="cursor-pointer text-sm font-semibold">Como pago pelo serviço?</summary><p className="mt-3 text-sm text-muted">O pagamento é feito diretamente no estabelecimento, não pelo aplicativo.</p></details>
      <div className="flex flex-wrap gap-2 pt-2"><button type="button" onClick={() => onToast("Contato com suporte demonstrativo.")} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">Falar com suporte</button><button type="button" onClick={() => onToast("A política de privacidade será publicada junto ao lançamento.")} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Política de privacidade</button><button type="button" onClick={() => onToast("Os termos de uso serão publicados junto ao lançamento.")} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Termos de uso</button></div>
    </div>}
  </section>;
}

function ClientAppointments({ appointments, onCancelAppointment, onConfirmPresence, onRescheduleAppointment, rules }: { appointments: Appointment[]; onCancelAppointment: (id: number) => void; onConfirmPresence: (id: number) => void; onRescheduleAppointment: (appointment: Appointment) => void; rules: BookingRules }) {
  const bookingDate = (item: Appointment) => new Date(`${item.date}T${item.time}:00`).getTime();
  const hoursUntil = (item: Appointment) => (bookingDate(item) - Date.now()) / 3_600_000;

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-xl border border-[#e8e9e6] bg-white p-4"><p className="font-semibold">Agendamento confirmado</p><p className="mt-1 text-sm text-muted">A empresa aceitou. O horário está reservado.</p></article>
      <article className="rounded-xl border border-[#e8e9e6] bg-white p-4"><p className="font-semibold">Aguardando confirmação</p><p className="mt-1 text-sm text-muted">A solicitação foi enviada e ainda precisa da aprovação da empresa.</p></article>
    </div>
    {appointments.filter((item) => item.customer === "João Almeida" && item.status !== "Concluído" && item.status !== "Cancelado").map((item) => {
      const timeLeft = hoursUntil(item);
      const canCancel = timeLeft >= rules.cancelLeadHours;
      const canReschedule = timeLeft >= rules.rescheduleLeadHours;
      const canConfirm = rules.checkInEnabled && timeLeft >= 0 && timeLeft <= rules.checkInLeadHours;
      return <article key={item.id} className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{item.service}</p><p className="mt-1 text-sm text-muted">{item.professional} · {formatDate(item.date)} às {item.time}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === "Aguardando" ? "bg-[#fff3df] text-[#8b6221]" : "bg-[#e7f2eb] text-[#217a5b]"}`}>{item.status === "Aguardando" ? "Aguardando confirmação" : "Confirmado"}</span></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{formatCurrency(item.price)} · pagamento no estabelecimento</span>{rules.checkInEnabled && <span className="text-muted">{item.presenceConfirmed ? "Presença confirmada" : `Confirmação disponível até ${rules.checkInLeadHours}h antes`}</span>}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {rules.checkInEnabled && <button type="button" disabled={!canConfirm || item.presenceConfirmed || item.status === "Aguardando"} onClick={() => onConfirmPresence(item.id)} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{item.presenceConfirmed ? "Presença confirmada" : "Confirmar presença"}</button>}
          <button type="button" disabled={!canReschedule} onClick={() => onRescheduleAppointment(item)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Reagendar</button>
          <button type="button" disabled={!canCancel} onClick={() => onCancelAppointment(item.id)} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">Cancelar</button>
        </div>
        {(!canCancel || !canReschedule) && <p className="mt-3 text-xs text-muted">O prazo mínimo definido pela empresa para alterações já foi atingido.</p>}
      </article>;
    })}
    {appointments.filter((item) => item.customer === "João Almeida" && (item.status === "Cancelado" || item.status === "Concluído")).map((item) => <article key={item.id} className="rounded-xl border border-[#e8e9e6] bg-white p-4 text-sm"><strong>{item.service}</strong><p className="mt-1 text-muted">{formatDate(item.date)} às {item.time} · {item.status}</p></article>)}
    {!appointments.some((item) => item.customer === "João Almeida") && <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted">Você ainda não tem agendamentos.</p>}
  </div>;
}

function BookingRulesPanel({ rules, onChange }: { rules: BookingRules; onChange: (rules: BookingRules) => void }) {
  const [selectedService, setSelectedService] = useState(services[0].name);
  const [selectedProfessional, setSelectedProfessional] = useState(professionals[0].name);
  const updateHours = (key: "checkInLeadHours" | "cancelLeadHours" | "rescheduleLeadHours", value: string) => {
    const hours = Number(value);
    if (Number.isFinite(hours) && hours >= 0 && hours <= 168) onChange({ ...rules, [key]: hours });
  };
  const updateLateThreshold = (value: string) => {
    const minutes = Number(value);
    if (Number.isInteger(minutes) && minutes >= 0 && minutes <= 180) onChange({ ...rules, lateThresholdMinutes: minutes });
  };
  const ruleKey = `${selectedProfessional}::${selectedService}`;
  const defaultCommissionRule: CommissionRule = { type: "percent", value: 40, release: "afterPayment", methods: ["PIX", "Cartão", "Dinheiro"] };
  const commissionRule = rules.commissionRules[ruleKey] ?? defaultCommissionRule;
  const updateCommissionRule = (update: Partial<CommissionRule>) => {
    const nextRule = { ...commissionRule, ...update };
    if (nextRule.type === "percent" && nextRule.value > 100) nextRule.value = 100;
    onChange({ ...rules, commissionRules: { ...rules.commissionRules, [ruleKey]: nextRule } });
  };
  const cashMethods: CashMethod[] = ["PIX", "Cartão", "Dinheiro"];
  return <section className="mt-5 max-w-3xl rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6">
    <h2 className="font-bold">Regras da empresa</h2><p className="mt-1 text-sm text-muted">Configurações demonstrativas do Ateliê Aurora. Em produção, precisam ser salvas e aplicadas no servidor.</p>
    <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border p-4 text-sm font-semibold">Permitir confirmação de presença pelo cliente<input type="checkbox" checked={rules.checkInEnabled} onChange={(event) => onChange({ ...rules, checkInEnabled: event.target.checked })} /></label>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      <label className="text-xs font-semibold">Confirmar presença até (horas antes)<input type="number" min="0" max="168" value={rules.checkInLeadHours} onChange={(event) => updateHours("checkInLeadHours", event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" disabled={!rules.checkInEnabled} /></label>
      <label className="text-xs font-semibold">Prazo mínimo para cancelar (horas)<input type="number" min="0" max="168" value={rules.cancelLeadHours} onChange={(event) => updateHours("cancelLeadHours", event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" /></label>
      <label className="text-xs font-semibold">Prazo mínimo para reagendar (horas)<input type="number" min="0" max="168" value={rules.rescheduleLeadHours} onChange={(event) => updateHours("rescheduleLeadHours", event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" /></label>
    </div>
    <h3 className="mt-7 border-t border-[#eee] pt-5 font-bold">Atrasos e faltas da equipe</h3>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold">Considerar atraso após (minutos)<input type="number" min="0" max="180" value={rules.lateThresholdMinutes} onChange={(event) => updateLateThreshold(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" /></label>
      <label className="text-xs font-semibold">Ação quando o profissional atrasar<select value={rules.lateProfessionalAction} onChange={(event) => onChange({ ...rules, lateProfessionalAction: event.target.value as BookingRules["lateProfessionalAction"] })} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"><option value="notifyClient">Avisar o cliente</option><option value="reschedule">Encaminhar para reagendamento pela recepção</option></select></label>
      <label className="text-xs font-semibold sm:col-span-2">Ação quando o profissional faltar<select value={rules.absentProfessionalAction} onChange={(event) => onChange({ ...rules, absentProfessionalAction: event.target.value as BookingRules["absentProfessionalAction"] })} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"><option value="notifyClient">Avisar o cliente</option><option value="automaticReschedule">Propor remarcação automática ao cliente</option><option value="contactClient">Recepção entra em contato para reagendar</option></select></label>
    </div>
    <h3 className="mt-7 border-t border-[#eee] pt-5 font-bold">Regras de comissão</h3>
    <p className="mt-1 text-sm text-muted">Configure a comissão para cada combinação de serviço e profissional. Só o administrador da empresa pode corrigir essas regras.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold">Serviço<select value={selectedService} onChange={(event) => setSelectedService(event.target.value)} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm">{services.map((service) => <option key={service.id}>{service.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Profissional<select value={selectedProfessional} onChange={(event) => setSelectedProfessional(event.target.value)} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm">{professionals.map((professional) => <option key={professional.id}>{professional.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Tipo de comissão<select value={commissionRule.type} onChange={(event) => updateCommissionRule({ type: event.target.value as CommissionRule["type"] })} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"><option value="percent">Percentual</option><option value="fixed">Valor fixo por atendimento</option></select></label>
      <label className="text-xs font-semibold">{commissionRule.type === "percent" ? "Percentual (%)" : "Valor fixo (R$)"}<input type="number" min="0" max={commissionRule.type === "percent" ? 100 : undefined} step="0.01" value={commissionRule.value} onChange={(event) => { const amount = Number(event.target.value); if (Number.isFinite(amount) && amount >= 0 && (commissionRule.type !== "percent" || amount <= 100)) updateCommissionRule({ value: amount }); }} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" /></label>
    </div>
    <fieldset className="mt-4 rounded-xl border p-4"><legend className="px-1 text-xs font-semibold">Formas presenciais elegíveis</legend><div className="flex flex-wrap gap-4">{cashMethods.map((method) => { const checked = commissionRule.methods.includes(method); return <label key={method} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} disabled={checked && commissionRule.methods.length === 1} onChange={(event) => updateCommissionRule({ methods: event.target.checked ? [...commissionRule.methods, method] : commissionRule.methods.filter((item) => item !== method) })} />{method}</label>; })}</div></fieldset>
    <label className="mt-4 block text-xs font-semibold">Liberar comissão<select value={commissionRule.release} onChange={(event) => updateCommissionRule({ release: event.target.value as CommissionRule["release"] })} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"><option value="afterCompletion">Após concluir o atendimento</option><option value="afterPayment">Após registrar o pagamento presencial no caixa</option></select></label>
  </section>;
}

type DemoTeamMember = { id: number; email: string; name: string; role: "Recepcionista" | "Profissional"; status: "Ativo" | "Convite pendente" };
type DemoSubscription = { cycle: string; cancelAtEnd: boolean; access: "Ativo" | "Parcialmente limitado" | "Suspenso"; retryCount: number };
const initialTeamMembers: DemoTeamMember[] = [
  { id: 1, name: "Fernanda Costa", email: "fernanda@exemplo.com", role: "Recepcionista", status: "Ativo" },
  { id: 2, name: "Marina Costa", email: "marina@exemplo.com", role: "Profissional", status: "Ativo" }
];

function TeamManagementPanel({ businessName, onToast }: { businessName: string; onToast: (message: string) => void }) {
  const storageKey = `${TEAM_SESSION_PREFIX}${businessName}`;
  const [members, setMembers] = useState<DemoTeamMember[]>(initialTeamMembers);
  const [membersReady, setMembersReady] = useState(false);
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState<DemoTeamMember["role"]>("Recepcionista");

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = teamStateSchema.safeParse(JSON.parse(saved));
        if (!parsed.success) throw new Error("Os membros locais têm um formato inválido.");
        setMembers(parsed.data);
      } else {
        setMembers(initialTeamMembers);
      }
    } catch (error) {
      console.error("Não foi possível restaurar a equipe demonstrativa.", error);
      onToast("A equipe demonstrativa não pôde ser restaurada nesta aba.");
    } finally {
      setMembersReady(true);
    }
  }, [businessName, onToast, storageKey]);

  useEffect(() => {
    if (!membersReady) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(members));
    } catch (error) {
      console.error("Não foi possível manter a equipe durante a navegação.", error);
      onToast("A alteração foi feita, mas a equipe pode ser perdida ao trocar de página.");
    }
  }, [members, membersReady, onToast, storageKey]);

  function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (members.some((member) => member.email.toLowerCase() === normalizedEmail)) {
      onToast("Este endereço já está na equipe ou possui um convite pendente.");
      return;
    }
    setMembers((current) => [...current, { id: Date.now(), name: normalizedEmail.split("@")[0], email: normalizedEmail, role: memberRole, status: "Convite pendente" }]);
    setEmail("");
    onToast("Convite demonstrativo registrado. Nenhum e-mail foi enviado.");
  }

  function removeMember(member: DemoTeamMember) {
    if (!window.confirm(`Remover ${member.name} da equipe de ${businessName}?`)) return;
    setMembers((current) => current.filter((item) => item.id !== member.id));
    onToast("Acesso removido somente nesta demonstração.");
  }

  return <section className="mt-5 max-w-4xl rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6">
    <h2 className="font-bold">Equipe · {businessName}</h2>
    <p className="mt-1 text-sm text-muted">Administrador da empresa e administrador EFAHub podem convidar ou remover funcionários. No protótipo, os convites não são enviados; as alterações duram apenas na sessão desta aba.</p>
    <form onSubmit={inviteMember} className="mt-5 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
      <label className="text-xs font-semibold">E-mail do funcionário<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm" placeholder="pessoa@empresa.com" /></label>
      <label className="text-xs font-semibold">Perfil<select value={memberRole} onChange={(event) => setMemberRole(event.target.value as DemoTeamMember["role"])} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"><option>Recepcionista</option><option>Profissional</option></select></label>
      <button type="submit" className="self-end rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Convidar</button>
    </form>
    <ul className="mt-5 divide-y divide-[#eee]">{members.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"><span><strong className="block text-sm">{member.name}</strong><span className="mt-1 block text-xs text-muted">{member.email} · {member.role} · {member.status}</span></span><button type="button" onClick={() => removeMember(member)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Remover</button></li>)}</ul>
  </section>;
}

function CashRegistrationPanel({ appointments, onMarkPayment }: { appointments: Appointment[]; onMarkPayment: (id: number, method: CashMethod) => void }) {
  const [methods, setMethods] = useState<Record<number, CashMethod>>({});
  const completed = appointments.filter((appointment) => appointment.status === "Concluído");

  return <section className="mt-5 rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6">
    <h2 className="font-bold">Registro de pagamentos presenciais</h2>
    <p className="mt-1 text-sm text-muted">Registre somente depois que o atendimento foi concluído e a empresa recebeu o valor no local. Isso não inicia cobrança, captura dinheiro nem envia pagamento pelo EFAHub.</p>
    <div className="mt-4 divide-y divide-[#eee]">{completed.map((appointment) => <div key={appointment.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0"><span className="min-w-0 flex-1"><strong className="block text-sm">{appointment.customer} · {appointment.service}</strong><span className="mt-1 block text-xs text-muted">{formatDate(appointment.date)} · {formatCurrency(appointment.price)}</span></span>{appointment.paymentStatus === "received" ? <span className="rounded-full bg-[#e7f2eb] px-3 py-1 text-xs font-semibold text-[#217a5b]">Recebido · {appointment.paymentMethod}</span> : <div className="flex flex-wrap items-center gap-2"><select aria-label={`Forma de pagamento presencial de ${appointment.customer}`} value={methods[appointment.id] ?? "PIX"} onChange={(event) => setMethods((current) => ({ ...current, [appointment.id]: event.target.value as CashMethod }))} className="rounded-lg border bg-white px-3 py-2 text-xs"><option>PIX</option><option>Cartão</option><option>Dinheiro</option></select><button type="button" onClick={() => onMarkPayment(appointment.id, methods[appointment.id] ?? "PIX")} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">Registrar recebido</button></div>}</div>)}</div>
    {!completed.length && <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-sm text-muted">Quando um atendimento for concluído, ele aparecerá aqui para registro.</p>}
  </section>;
}

function SubscriptionPanel({ role, onToast }: { role: "businessAdmin" | "platformAdmin"; onToast: (message: string) => void }) {
  const storageKey = `efahub-demo-subscription-v1:${role}`;
  const [subscription, setSubscription] = useState<DemoSubscription>({ cycle: "Mensal", cancelAtEnd: false, access: "Ativo", retryCount: 0 });
  const [subscriptionReady, setSubscriptionReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = subscriptionStateSchema.safeParse(JSON.parse(saved));
        if (!parsed.success) throw new Error("A assinatura local tem um formato inválido.");
        setSubscription(parsed.data);
      }
    } catch (error) {
      console.error("Não foi possível restaurar o estado da assinatura demonstrativa.", error);
      onToast("A assinatura demonstrativa não pôde ser restaurada nesta aba.");
    } finally {
      setSubscriptionReady(true);
    }
  }, [onToast, storageKey]);

  useEffect(() => {
    if (!subscriptionReady) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(subscription));
    } catch (error) {
      console.error("Não foi possível manter a assinatura durante a navegação.", error);
      onToast("A alteração foi feita, mas a assinatura pode ser perdida ao trocar de página.");
    }
  }, [onToast, subscription, subscriptionReady, storageKey]);

  return <section className="mt-5 max-w-4xl rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6">
    <h2 className="font-bold">{role === "businessAdmin" ? "Assinatura da empresa com o EFAHub" : "Gestão das assinaturas do EFAHub"}</h2>
    <p className="mt-1 text-sm text-muted">Controles demonstrativos: nenhuma cobrança, renovação, notificação ou alteração de acesso é executada de verdade.</p>
    {role === "businessAdmin" ? <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
      <div className="rounded-xl bg-[#f7f7f5] p-4"><p className="text-xs text-muted">Plano contratado · ciclo {subscription.cycle.toLowerCase()}</p><strong className="mt-1 block">EFAHub Pro · renovação recorrente</strong><p className="mt-2 text-sm text-muted">{subscription.cancelAtEnd ? "Cancelamento solicitado. A assinatura continua ativa até o fim do período já pago e não haverá nova cobrança." : "Assinatura ativa; a próxima renovação ocorrerá ao final do ciclo pago."}</p></div>
      <div><label className="text-xs font-semibold">Ciclo<select value={subscription.cycle} onChange={(event) => setSubscription((current) => ({ ...current, cycle: event.target.value }))} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"><option>Mensal</option><option>Trimestral</option><option>Semestral</option><option>Anual</option></select></label><button type="button" onClick={() => { if (!subscription.cancelAtEnd && !window.confirm("A assinatura ficará ativa até o fim do período pago e não haverá novas cobranças. Solicitar cancelamento?")) return; setSubscription((current) => ({ ...current, cancelAtEnd: !current.cancelAtEnd })); onToast(subscription.cancelAtEnd ? "Reativação demonstrativa solicitada." : "Cancelamento demonstrativo programado para o fim do período pago."); }} className="mt-3 w-full rounded-xl border border-[#e5e6e2] px-4 py-3 text-sm font-semibold">{subscription.cancelAtEnd ? "Reativar renovação" : "Solicitar cancelamento"}</button></div>
    </div> : <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="rounded-xl bg-[#f7f7f5] p-4"><p className="text-xs text-muted">Conta demonstrativa · Ateliê Aurora</p><strong className="mt-1 block">Pagamento pendente</strong><p className="mt-2 text-sm text-muted">Falhas podem gerar novas tentativas e notificações; o acesso pode ficar parcialmente limitado ou suspenso até a regularização.</p><p className="mt-2 text-xs text-muted">Tentativas simuladas nesta tela: {subscription.retryCount}</p></div>
      <div><label className="text-xs font-semibold">Acesso da empresa<select value={subscription.access} onChange={(event) => setSubscription((current) => ({ ...current, access: event.target.value as DemoSubscription["access"] }))} className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"><option>Ativo</option><option>Parcialmente limitado</option><option>Suspenso</option></select></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setSubscription((current) => ({ ...current, retryCount: current.retryCount + 1 })); onToast("Tentativa de cobrança apenas simulada; nenhum pagamento foi processado."); }} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">Simular nova tentativa</button><button type="button" onClick={() => onToast("Notificação de atraso apenas simulada; nenhuma mensagem foi enviada.")} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Simular aviso</button></div></div>
    </div>}
    <p className="mt-4 border-t border-[#eee] pt-4 text-xs leading-5 text-muted">O cancelamento não apaga imediatamente os dados. Eles podem ser mantidos para eventual reativação e obrigações legais, observando a política de retenção e privacidade.</p>
  </section>;
}

function CouponManager({ coupons, onCouponsChange, onToast }: { coupons: DemoCoupon[]; onCouponsChange: (coupons: DemoCoupon[]) => void; onToast: (message: string) => void }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<DemoCoupon["kind"]>("percent");
  const [value, setValue] = useState("10");
  const [expiry, setExpiry] = useState("");
  const [uses, setUses] = useState("100");
  const [service, setService] = useState("Todos os serviços");
  const [campaign, setCampaign] = useState("");
  const inputClass = "mt-2 w-full rounded-xl border border-[#e5e6e2] bg-white px-3 py-3 text-sm";

  function resetForm() {
    setEditingId(null);
    setCode("");
    setValue("10");
    setExpiry("");
    setUses("100");
    setService("Todos os serviços");
    setCampaign("");
  }
  function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const discountValue = Number(value);
    const maxUses = Number(uses);
    if (!code.trim() || !expiry || !Number.isFinite(discountValue) || discountValue <= 0 || (kind === "percent" && discountValue > 100) || !Number.isInteger(maxUses) || maxUses <= 0) {
      onToast("Preencha código, validade, desconto e limite de usos válidos.");
      return;
    }
    const oldCoupon = coupons.find((item) => item.id === editingId);
    const updatedCoupon: DemoCoupon = { id: editingId ?? Date.now(), code: code.trim().toUpperCase(), kind, value: discountValue, expiry, maxUses, usedCount: oldCoupon?.usedCount ?? 0, service, campaign: campaign.trim() || "Sem campanha" };
    onCouponsChange(editingId === null ? [updatedCoupon, ...coupons] : coupons.map((item) => item.id === editingId ? updatedCoupon : item));
    onToast(`Cupom ${updatedCoupon.code} salvo apenas nesta demonstração.`);
    resetForm();
  }
  function editCoupon(coupon: DemoCoupon) {
    setEditingId(coupon.id);
    setCode(coupon.code);
    setKind(coupon.kind);
    setValue(String(coupon.value));
    setExpiry(coupon.expiry);
    setUses(String(coupon.maxUses));
    setService(coupon.service);
    setCampaign(coupon.campaign);
  }

  return <section className="mt-5 max-w-5xl rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6">
    <h2 className="font-bold">Cupons de desconto</h2><p className="mt-1 text-sm text-muted">Crie ou edite cupons demonstrativos. Eles não são publicados nem persistidos no servidor.</p>
    <form onSubmit={submitCoupon} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-semibold">Código<input required value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} placeholder="EXEMPLO10" /></label>
      <label className="text-xs font-semibold">Tipo de desconto<select value={kind} onChange={(event) => setKind(event.target.value as DemoCoupon["kind"])} className={inputClass}><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></label>
      <label className="text-xs font-semibold">Desconto<input required min="0.01" step="0.01" type="number" value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} /></label>
      <label className="text-xs font-semibold">Válido até<input required type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} className={inputClass} /></label>
      <label className="text-xs font-semibold">Quantidade máxima de usos<input required min="1" step="1" type="number" value={uses} onChange={(event) => setUses(event.target.value)} className={inputClass} /></label>
      <label className="text-xs font-semibold">Serviço<select value={service} onChange={(event) => setService(event.target.value)} className={inputClass}><option>Todos os serviços</option>{services.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Campanha<input value={campaign} onChange={(event) => setCampaign(event.target.value)} className={inputClass} placeholder="Ex.: Primeira visita" /></label>
      <div className="flex items-end gap-2"><button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">{editingId === null ? "Criar cupom" : "Salvar edição"}</button>{editingId !== null && <button type="button" onClick={resetForm} className="rounded-xl border px-4 py-3 text-sm font-semibold">Cancelar</button>}</div>
    </form>
    <div className="mt-6 space-y-3">{coupons.map((coupon) => <article key={coupon.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8e9e6] p-4"><div><strong>{coupon.code}</strong><p className="mt-1 text-sm text-muted">{coupon.kind === "percent" ? `${coupon.value}% de desconto` : `${formatCurrency(coupon.value)} de desconto`} · até {formatDate(coupon.expiry)} · {coupon.usedCount} de {coupon.maxUses} usos</p><p className="mt-1 text-xs text-muted">{coupon.service} · Campanha: {coupon.campaign}</p></div><button type="button" onClick={() => editCoupon(coupon)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Editar</button></article>)}</div>
  </section>;
}

function ModuleView({ role, view, appointments, onBook, onToast, onComplete, onMarkPayment, onQuickCreate, onNavigate, onViewBusiness, businessId, favoriteBusinessIds, onToggleFavorite, themePreference, resolvedTheme, onThemeChange, onCancelAppointment, onConfirmPresence, onRescheduleAppointment, bookingRules, onBookingRulesChange, coupons, onCouponsChange }: Props) {
  const upcoming = appointments.filter((item) => item.status !== "Concluído" && item.status !== "Cancelado");
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
    payments: ["Caixa e recebimentos", "Anote pagamentos feitos diretamente no estabelecimento. O app não processa cobranças de serviços."],
    team: ["Profissionais", "Equipe, metas, permissões e disponibilidade."],
    services: ["Serviços", "Catálogo, preços, duração e profissionais habilitados."],
    finance: ["Financeiro", "Gestão da empresa: receitas anotadas após recebimento no local, despesas e comissões."],
    reports: ["Relatórios", "Acompanhe resultados por período, serviço e profissional."],
    marketing: ["Marketing e fidelidade", "Campanhas, cupons, cashback e relacionamento."],
    inventory: ["Produtos e estoque", "Inventário, movimentações e alertas de reposição."],
    settings: ["Configurações", "Dados da empresa, unidades, horários e permissões."],
    businesses: ["Empresas", "Gestão de contas e ciclo de vida dos estabelecimentos."],
    subscriptions: ["Assinaturas EFAHub", "Planos, cobranças e status das assinaturas pagas pelas empresas ao EFAHub."],
    support: ["Central de suporte", "Chamados, priorização e acompanhamento de solicitações."],
    audit: ["Auditoria", "Atividades e alterações registradas na plataforma."]
  };
  const [defaultTitle, defaultDetail] = moduleTitles[view] ?? ["Área de trabalho", "Resumo da operação."];
  const isClient = role === "client";
  const isPlatform = role === "platformAdmin";
  const isEmployee = role === "employee";
  const title = isPlatform && view === "finance" ? "Financeiro EFAHub" : defaultTitle;
  const detail = isPlatform && view === "finance" ? "Acompanhe somente as assinaturas e cobranças pagas pelas empresas ao EFAHub." : defaultDetail;
  const primaryAction = isClient ? "Encontrar horário" : "Novo agendamento";
  const showPrimaryAction = view !== "newBooking" && view !== "newClient";

  return (
    <>
      <DemoNotice />
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.16em] text-[var(--accent)]">{roleOptions.find((item) => item.id === role)?.label.toUpperCase()}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted">{detail}</p></div>{showPrimaryAction && <button type="button" onClick={() => isClient ? onBook() : onNavigate("newBooking")} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">{primaryAction}</button>}</div>
      {view === "favorites" && (favoriteBusinessIds.length ? <BusinessCards onBook={onBook} onViewBusiness={onViewBusiness} favoriteBusinessIds={favoriteBusinessIds} onToggleFavorite={onToggleFavorite} items={businesses.filter((business) => favoriteBusinessIds.includes(business.id))} /> : <section className="rounded-2xl border border-dashed border-[#dfe1dc] bg-white p-8 text-center"><h2 className="font-bold">Você ainda não salvou empresas</h2><p className="mt-2 text-sm text-muted">Toque no coração de uma empresa para encontrá-la aqui.</p><button type="button" onClick={() => onNavigate("search")} className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">Buscar empresas</button></section>)}
      {view === "search" && <ClientSearchView onBook={onBook} onViewBusiness={(id) => onViewBusiness(id)} />}
      {(view === "business" || view === "companyServices") && <ClientBusinessView onBook={onBook} onViewBusiness={onViewBusiness} businessId={businessId} servicesOnly={view === "companyServices"} />}
      {view === "newBooking" && <QuickBookingForm onCreate={onQuickCreate} allowBusinessSelection={isPlatform} />}
      {view === "newClient" && <NewClientForm onToast={onToast} />}
      {view === "reports" && <ReportsView />}
      {view === "appointments" && isClient && <ClientAppointments appointments={appointments} onCancelAppointment={onCancelAppointment} onConfirmPresence={onConfirmPresence} onRescheduleAppointment={onRescheduleAppointment} rules={bookingRules} />}
      {(view === "agenda" || view === "checkin" || (view === "appointments" && !isClient)) && <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title={view === "checkin" ? "Fila de atendimento" : "Próximos horários"} detail="Dados fictícios para demonstração" /><AppointmentList items={upcoming} showActions={!isClient} onComplete={onComplete} onCancel={onCancelAppointment} onReschedule={onRescheduleAppointment} onToast={onToast} /></section>}
      {view === "clients" && <section className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft sm:p-6"><SectionHeading title="Clientes recentes" detail="Histórico resumido baseado em dados de demonstração" /><div className="divide-y divide-[#eee]">{appointments.map((item) => <div key={item.id} className="flex items-center gap-3 py-4 first:pt-0"><span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">{item.customer.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="flex-1"><p className="text-sm font-semibold">{item.customer}</p><p className="mt-1 text-xs text-muted">{item.service} · última visita {formatDate(item.date)}</p></div><button type="button" onClick={() => onToast("Perfil do cliente demonstrativo.")} className="rounded-lg border border-[#e5e6e2] px-3 py-2 text-xs font-semibold">Ver perfil</button></div>)}</div></section>}
      {view === "notifications" && <section className="space-y-3">{["Seu horário está confirmado", "Novidades perto de você", "Avalie sua última experiência"].map((notice, index) => <article key={notice} className="rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft"><p className="text-xs text-muted">{index + 1} h atrás</p><h2 className="mt-2 font-bold">{notice}</h2><p className="mt-1 text-sm text-muted">Acompanhe novidades e informações importantes da sua conta EFAHub.</p></article>)}</section>}
      {view === "profile" && role === "client" && <ClientProfile onToast={onToast} />}
      {(view === "profile" || view === "settings") && <div className="mt-6"><ThemePreferencePanel preference={themePreference} resolvedTheme={resolvedTheme} onChange={onThemeChange} /></div>}
      {view === "settings" && role === "businessAdmin" && <BookingRulesPanel rules={bookingRules} onChange={onBookingRulesChange} />}
      {view === "settings" && role === "businessAdmin" && <SubscriptionPanel key="business-subscription" role="businessAdmin" onToast={onToast} />}
      {view === "subscriptions" && role === "platformAdmin" && <SubscriptionPanel key="platform-subscription" role="platformAdmin" onToast={onToast} />}
      {view === "team" && role === "businessAdmin" && <TeamManagementPanel businessName={businesses[0].name} onToast={onToast} />}
      {view === "marketing" && role === "businessAdmin" && <CouponManager coupons={coupons} onCouponsChange={onCouponsChange} onToast={onToast} />}
      {["team", "services", "finance", "marketing", "inventory", "settings", "earnings", "payments", "businesses", "subscriptions", "support", "audit"].includes(view) && <ModuleCards role={role} view={view} onToast={onToast} />}
      {isPlatform && view === "businesses" && <div className="mt-5 rounded-2xl border border-[#e8e9e6] bg-white p-5 shadow-soft"><PlatformBusinessTable onToast={onToast} appointments={appointments} onComplete={onComplete} onCancelAppointment={onCancelAppointment} onRescheduleAppointment={onRescheduleAppointment} /></div>}
      {isEmployee && view === "payments" && <div className="mt-5"><div className="mb-4 grid gap-4 sm:grid-cols-3"><MetricCard label="Aguardando pagamento no local" value="R$ 420" note="4 atendimentos" icon={Clock3} /><MetricCard label="Registrado como recebido" value="R$ 1.280" note="8 lançamentos demonstrativos" icon={Check} /><MetricCard label="Pendências de registro" value="4" note="última atualização local" icon={Clock3} /></div><CashRegistrationPanel appointments={appointments} onMarkPayment={onMarkPayment} /></div>}
      {role === "businessAdmin" && view === "finance" && <CashRegistrationPanel appointments={appointments} onMarkPayment={onMarkPayment} />}
    </>
  );
}

function ModuleCards({ role, view, onToast }: { role: Role; view: ViewId; onToast: (message: string) => void }) {
  const entries: Record<string, [string, string, LucideIcon][]> = {
    team: [["Equipe ativa", "8 profissionais", Users], ["Comissões do mês", "R$ 6.840 em aberto", Wallet], ["Disponibilidade", "Jornadas e bloqueios", CalendarDays]],
    services: [["Catálogo ativo", "18 serviços publicados", Sparkles], ["Preço médio", "R$ 96,50", Wallet], ["Mais procurado", "Corte personalizado", Activity]],
    finance: [["Receita registrada", "R$ 42.680 no mês", Wallet], ["Despesas", "R$ 12.400 no mês", ArrowDownRight], ["Comissões", "R$ 6.840 pendentes", Users]],
    marketing: [["Campanhas ativas", "3 comunicações", Activity], ["Cupons disponíveis", "2 ofertas", Sparkles], ["Programa de fidelidade", "124 participantes", Heart]],
    inventory: [["Produtos cadastrados", "42 itens", Package], ["Estoque baixo", "3 alertas", Bell], ["Última movimentação", "Hoje às 09:14", Clock3]],
    settings: [["Dados da empresa", "Perfil e unidades", Store], ["Equipe e permissões", "Papéis e acessos", ShieldCheck], ["Horários e reservas", "Regras de atendimento", CalendarDays]],
    earnings: [["Comissão hoje", "R$ 204,00", Wallet], ["Comissão da semana", "R$ 1.090", Activity], ["Meta mensal", "72% concluída", ArrowUpRight]],
    payments: [["PIX presencial", "Anotar após receber no estabelecimento", CreditCard], ["Cartão presencial", "Anotar após receber no estabelecimento", CreditCard], ["Dinheiro presencial", "Anotar após receber no estabelecimento", Wallet]],
    businesses: [["Empresas ativas", "1.284 contas", Store], ["Em onboarding", "42 empresas", Users], ["Ações pendentes", "9 solicitações", Clock3]],
    subscriptions: [["Planos mensais", "1.012 assinaturas", CreditCard], ["Planos anuais", "272 assinaturas", CreditCard], ["Inadimplência", "2,1% das contas", Activity]],
    support: [["Abertos", "26 chamados", CircleHelp], ["Prioridade alta", "4 solicitações", Activity], ["Tempo médio", "3h 18min", Clock3]],
    audit: [["Eventos de hoje", "8.490 registros", Activity], ["Acessos suspeitos", "2 para revisão", ShieldCheck], ["Última sincronização", "Há 4 minutos", Clock3]]
  };
  const platformFinance = [["Receita de assinaturas", "Cobranças dos planos do EFAHub", Wallet], ["Assinaturas recebidas", "Pagamentos destinados ao EFAHub", CreditCard], ["Inadimplência", "Contas da plataforma pendentes", Activity]] as [string, string, LucideIcon][];
  const cards = role === "platformAdmin" && view === "finance" ? platformFinance : entries[view] ?? [];
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([title, detail, Icon]) => <button key={title} onClick={() => onToast(`${title}: painel demonstrativo. Os dados reais dependem da integração do backend.`)} type="button" className="module-card rounded-2xl border border-[#e8e9e6] bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-[#d3c4b4]"><span className="metric-icon"><Icon size={17} /></span><h2 className="mt-4 font-bold">{title}</h2><p className="mt-1 text-sm text-muted">{detail}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">Abrir módulo <ArrowRight size={13} /></span></button>)}</div>;
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

function BookingWizard({ onClose, onConfirm, initialStep = 0, initialBusinessId = "atelier", initialServiceId, initialCustomer = "João Almeida", coupons, onStepChange }: { onClose: () => void; onConfirm: (booking: Booking) => void; initialStep?: number; initialBusinessId?: string; initialServiceId?: string; initialCustomer?: string; coupons: DemoCoupon[]; onStepChange: (step: number) => void }) {
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
  const [business, setBusiness] = useState(() => businesses.find((item) => item.id === initialBusinessId) ?? businesses[0]);
  const [service, setService] = useState(() => services.find((item) => item.id === initialServiceId) ?? services[0]);
  const [professional, setProfessional] = useState(professionals[0]);
  const [serviceCategory, setServiceCategory] = useState("Todas");
  const [serviceType, setServiceType] = useState("Todos");
  const [professionalFilter, setProfessionalFilter] = useState("Todos");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<DemoCoupon | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
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
    defaultValues: { customer: initialCustomer, phone: "(11) 99999-9999" }
  });
  const steps = ["Empresa", "Serviço", "Profissional", "Data e horário", "Resumo"];
  const categories = ["Todas", ...new Set(services.map((item) => item.category))];
  const filteredServices = services.filter((item) =>
    (serviceCategory === "Todas" || item.category === serviceCategory) &&
    (serviceType === "Todos" || item.type === serviceType)
  );
  const filteredProfessionals = professionals.filter((item) => professionalFilter === "Todos" || item.id === professionalFilter);
  const activeCoupon = appliedCoupon &&
    appliedCoupon.expiry >= toDateValue(new Date()) &&
    appliedCoupon.usedCount < appliedCoupon.maxUses &&
    (appliedCoupon.service === "Todos os serviços" || appliedCoupon.service === service.name)
    ? appliedCoupon
    : null;
  const discount = activeCoupon ? Math.min(service.price, activeCoupon.kind === "percent" ? service.price * activeCoupon.value / 100 : activeCoupon.value) : 0;
  const finalPrice = Math.max(0, service.price - discount);
  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => toDateValue(new Date(year, month, index + 1)))];
  }, [visibleMonth]);
  const canContinue = step < 4;
  const canAdvance =
    (step !== 1 || filteredServices.some((item) => item.id === service.id)) &&
    (step !== 2 || filteredProfessionals.some((item) => item.id === professional.id)) &&
    (step !== 3 || Boolean(time));

  function applyCoupon() {
    const normalizedCode = couponCode.trim().toUpperCase();
    const coupon = coupons.find((item) => item.code === normalizedCode);
    const today = toDateValue(new Date());
    const isEligible = coupon &&
      coupon.expiry >= today &&
      coupon.usedCount < coupon.maxUses &&
      (coupon.service === "Todos os serviços" || coupon.service === service.name);
    if (!coupon || !isEligible) {
      setAppliedCoupon(null);
      setCouponMessage("Cupom inválido, expirado, esgotado ou não aplicável a este serviço.");
      return;
    }
    setAppliedCoupon(coupon);
    setCouponMessage(`Cupom ${coupon.code} aplicado nesta demonstração.`);
  }

  function selectService(nextService: typeof services[number]) {
    setService(nextService);
    if (appliedCoupon && appliedCoupon.service !== "Todos os serviços" && appliedCoupon.service !== nextService.name) {
      setAppliedCoupon(null);
      setCouponMessage("Cupom removido: não se aplica ao serviço selecionado.");
    }
  }

  function confirm(contact: BookingContact) {
    onConfirm({ customer: contact.customer, business: business.name, service: service.name, professional: professional.name, date, time, price: finalPrice, couponCode: activeCoupon?.code });
  }

  return (
    <div className="booking-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="booking-dialog rounded-3xl bg-white p-5 shadow-2xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.15em] text-[var(--accent)]">AGENDAMENTO ONLINE</p><h2 id="booking-title" className="mt-2 text-2xl font-bold">Reserve seu horário</h2></div><button type="button" onClick={onClose} aria-label="Fechar agendamento" className="grid size-9 place-items-center rounded-full bg-[#f3f3f0]"><X size={18} /></button></div>
        <div className="my-6 flex items-center gap-1 overflow-x-auto pb-2">{steps.map((label, index) => <div key={label} className="flex min-w-0 flex-1 items-center gap-2"><span className={`step-dot ${index === step ? "active" : index < step ? "done" : ""}`}>{index < step ? <Check size={14} /> : index + 1}</span><span className={`hidden text-xs font-semibold sm:block ${index === step ? "text-ink" : "text-muted"}`}>{label}</span>{index < steps.length - 1 && <span className="h-px min-w-3 flex-1 bg-[#e9eae7]" />}</div>)}</div>
        {step === 0 && <div><p className="mb-3 text-sm text-muted">Escolha onde deseja ser atendido.</p><div className="grid gap-3 sm:grid-cols-2">{businesses.map((item) => <button type="button" key={item.id} onClick={() => setBusiness(item)} className={`rounded-2xl border p-4 text-left ${business.id === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[#e8e9e6]"}`}><span className="flex items-center justify-between"><strong>{item.name}</strong><span className="flex items-center gap-1 text-xs"><Star className="fill-[#d6a64c] text-[#d6a64c]" size={13} />{item.rating}</span></span><span className="mt-2 block text-xs text-muted">{item.category} · {item.distance}</span><span className="mt-1 block text-xs text-muted">{item.location}</span></button>)}</div></div>}
        {step === 1 && <div>
          <p className="mb-3 text-sm text-muted">Filtre e escolha o serviço que deseja agendar.</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">Categoria<select value={serviceCategory} onChange={(event) => setServiceCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e5e6e2] bg-white px-3 py-3 text-sm"><option>Todas</option>{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="text-xs font-semibold">Tipo de atendimento<select value={serviceType} onChange={(event) => setServiceType(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e5e6e2] bg-white px-3 py-3 text-sm"><option>Todos</option><option>No estabelecimento</option></select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{filteredServices.map((item) => <button type="button" key={item.id} onClick={() => selectService(item)} aria-pressed={service.id === item.id} className={`rounded-2xl border p-4 text-left ${service.id === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[#e8e9e6]"}`}><strong>{item.name}</strong><span className="mt-2 flex justify-between text-xs text-muted"><span>{item.category} · {item.duration}</span><b className="text-ink">{formatCurrency(item.price)}</b></span></button>)}</div>
          {!filteredServices.length && <p className="mt-4 text-sm text-muted">Nenhum serviço corresponde aos filtros.</p>}
        </div>}
        {step === 2 && <div>
          <p className="mb-3 text-sm text-muted">Escolha quem vai atender você.</p>
          <label className="mb-4 block max-w-sm text-xs font-semibold">Filtrar profissional<select value={professionalFilter} onChange={(event) => setProfessionalFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e5e6e2] bg-white px-3 py-3 text-sm"><option value="Todos">Todos os profissionais</option>{professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">{filteredProfessionals.map((item) => <button type="button" key={item.id} onClick={() => setProfessional(item)} aria-pressed={professional.id === item.id} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${professional.id === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[#e8e9e6]"}`}><span className="step-dot shrink-0">{item.name.split(" ").map((part) => part[0]).join("")}</span><span><strong className="block text-sm">{item.name}</strong><small className="mt-1 block text-muted">{item.role} · {item.years}</small><small className="mt-1 flex items-center gap-1 text-muted"><Star className="fill-[#d6a64c] text-[#d6a64c]" size={12} />{item.rating}</small></span></button>)}</div>
        </div>}
        {step === 3 && <div><p className="mb-3 text-sm text-muted">Escolha a data; os horários disponíveis aparecem logo abaixo.</p><div className="mb-4 flex items-center justify-between"><button type="button" aria-label="Mês anterior" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-9 place-items-center rounded-lg border border-[#e8e9e6]"><ChevronLeft size={17} /></button><strong className="capitalize">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(visibleMonth)}</strong><button type="button" aria-label="Próximo mês" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-9 place-items-center rounded-lg border border-[#e8e9e6]"><ChevronRight size={17} /></button></div><div className="grid grid-cols-7 gap-1.5 sm:gap-2">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={`${day}-${index}`} className="py-2 text-center text-[11px] font-semibold text-muted">{day}</span>)}{calendarDays.map((item, index) => { if (!item) return <span key={`empty-${index}`} />; const status = getDemoDateStatus(parseDateValue(item)); const unavailable = status !== "available"; const statusLabel = status === "available" ? "disponível" : status === "full" ? "esgotada" : status === "blocked" ? "bloqueada" : "passada"; return <button key={item} type="button" aria-label={`${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(parseDateValue(item))}, ${statusLabel}`} disabled={unavailable} title={`Data ${statusLabel}`} onClick={() => setDate(item)} className={`calendar-day min-h-12 !min-h-12 px-1 py-1 text-xs ${date === item ? "selected" : ""} ${unavailable ? "cursor-not-allowed opacity-45" : "hover:border-[var(--accent)]"}`}><strong className="text-sm">{parseDateValue(item).getDate()}</strong><span className={`mt-0.5 size-1.5 rounded-full ${status === "available" ? "bg-[#45866a]" : status === "full" ? "bg-[#d19b49]" : status === "blocked" ? "bg-[#c36d5f]" : "bg-transparent"}`} /></button>; })}</div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#45866a]" />Disponível</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#d19b49]" />Esgotada</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#c36d5f]" />Bloqueada</span></div><div className="mt-6 border-t border-[#e8e9e6] pt-5"><p className="mb-3 text-sm font-semibold">Horários para {formatDate(date)}</p>{[{ label: "Manhã", times: ["09:00", "09:45", "10:30", "11:15"] }, { label: "Tarde", times: ["13:00", "14:00", "15:30", "16:15", "17:00"] }, { label: "Noite", times: ["18:30", "19:15", "20:00"] }].map((group) => <div key={group.label} className="mb-4 last:mb-0"><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{group.label}</h3><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{group.times.map((slot) => <button key={slot} type="button" aria-pressed={time === slot} onClick={() => setTime(slot)} className={`slot-button rounded-xl px-3 py-3 text-sm font-semibold ${time === slot ? "selected" : ""}`}>{slot}</button>)}</div></div>)}</div><p className="mt-3 text-xs text-muted">Horários ilustrativos. A disponibilidade real deve ser confirmada pela empresa.</p></div>}
        {step === 4 && <div>
          <p className="mb-4 text-sm text-muted">Revise o agendamento. O pagamento será feito no estabelecimento.</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">Nome completo<input {...contactForm.register("customer")} aria-invalid={Boolean(contactForm.formState.errors.customer)} className="mt-2 w-full rounded-xl border border-[#e5e6e2] px-3 py-3 text-sm font-normal" autoComplete="name" />{contactForm.formState.errors.customer && <span className="mt-1 block text-xs text-red-700">{contactForm.formState.errors.customer.message}</span>}</label>
            <label className="text-xs font-semibold">Celular <span className="font-normal text-muted">(opcional)</span><input {...contactForm.register("phone")} aria-invalid={Boolean(contactForm.formState.errors.phone)} className="mt-2 w-full rounded-xl border border-[#e5e6e2] px-3 py-3 text-sm font-normal" type="tel" autoComplete="tel" placeholder="(11) 99999-9999" />{contactForm.formState.errors.phone && <span className="mt-1 block text-xs text-red-700">{contactForm.formState.errors.phone.message}</span>}</label>
          </div>
          <div className="mb-4 flex gap-2">
            <label className="flex-1 text-xs font-semibold">Cupom de desconto<input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} className="mt-2 w-full rounded-xl border border-[#e5e6e2] px-3 py-3 text-sm font-normal uppercase" placeholder="Ex.: EFA10" aria-label="Código do cupom" /></label>
            <button type="button" onClick={applyCoupon} className="mt-5 self-end rounded-xl border border-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent)]"><Tag className="mr-1 inline" size={15} />Aplicar</button>
          </div>
          {couponMessage && <p role="status" className={`mb-3 text-sm ${activeCoupon ? "text-success" : "text-red-700"}`}>{couponMessage}</p>}
          <p className="mb-4 text-xs text-muted">Cupons e valores são demonstrativos. Pagamentos de serviços ocorrem diretamente no estabelecimento.</p>
          <div className="rounded-2xl bg-[#f8f7f4] p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted">EMPRESA</p><p className="mt-1 font-bold">{business.name}</p></div><button type="button" onClick={() => setStep(0)} className="text-xs font-semibold text-[var(--accent)]">Alterar</button></div>
            <div className="my-4 border-t border-[#e5e3de]" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs text-muted">SERVIÇO</p><p className="mt-1 font-semibold">{service.name}</p><p className="mt-1 text-xs text-muted">{service.duration}</p></div>
              <div><p className="text-xs text-muted">PROFISSIONAL</p><p className="mt-1 font-semibold">{professional.name}</p></div>
              <div><p className="text-xs text-muted">DATA</p><p className="mt-1 font-semibold">{formatDate(date)}</p></div>
              <div><p className="text-xs text-muted">HORÁRIO</p><p className="mt-1 font-semibold">{time}</p></div>
            </div>
            <div className="my-4 border-t border-[#e5e3de]" />
            <div className="flex justify-between text-sm"><span className="text-muted">Valor do serviço</span><strong>{formatCurrency(service.price)}</strong></div>
            {activeCoupon && <div className="mt-2 flex justify-between text-sm text-success"><span>Desconto ({activeCoupon.code})</span><strong>− {formatCurrency(discount)}</strong></div>}
            <div className="mt-2 flex justify-between"><span className="font-semibold">Valor no estabelecimento</span><strong>{formatCurrency(finalPrice)}</strong></div>
          </div>
        </div>}
        <div className="mt-7 flex justify-between gap-3 border-t border-[#eee] pt-5"><button type="button" disabled={step === 0} onClick={() => { const next = Math.max(0, step - 1); setStep(next); onStepChange(next); }} className="rounded-xl border border-[#e5e6e2] px-5 py-3 text-sm font-semibold disabled:opacity-40">Voltar</button>{canContinue ? <button type="button" disabled={!canAdvance} onClick={() => { const next = step + 1; setStep(next); onStepChange(next); }} className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Continuar <ArrowRight className="ml-2 inline" size={15} /></button> : <button type="button" onClick={() => void contactForm.handleSubmit(confirm)()} className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white"><Check className="mr-2 inline" size={15} />Confirmar agendamento</button>}</div>
      </section>
    </div>
  );
}

export default function EfaHubApp({ initialRole = "businessAdmin", initialView = "home", initialBookingStep, initialBusinessId = "atelier" }: { initialRole?: Role; initialView?: ViewId; initialBookingStep?: number; initialBusinessId?: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [view, setView] = useState<ViewId>(initialView);
  const [appointments, setAppointments] = useState<Appointment[]>(makeInitialAppointments);
  const [appointmentsReady, setAppointmentsReady] = useState(false);
  const [coupons, setCoupons] = useState<DemoCoupon[]>(initialDemoCoupons);
  const [couponsReady, setCouponsReady] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(initialBookingStep !== undefined);
  const [bookingOptions, setBookingOptions] = useState<BookingOptions>({ businessId: initialBusinessId, step: initialBookingStep });
  const [reschedulingId, setReschedulingId] = useState<number | null>(null);
  const [bookingRules, setBookingRules] = useState<BookingRules>({
    checkInEnabled: true,
    checkInLeadHours: 24,
    cancelLeadHours: 12,
    rescheduleLeadHours: 12,
    lateThresholdMinutes: 15,
    lateProfessionalAction: "notifyClient",
    absentProfessionalAction: "contactClient",
    commissionRules: {}
  });
  const [bookingRulesReady, setBookingRulesReady] = useState(false);
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
      const saved = window.sessionStorage.getItem(APPOINTMENTS_SESSION_KEY);
      if (saved) {
        const parsed = appointmentStateSchema.safeParse(JSON.parse(saved));
        if (!parsed.success) throw new Error("Os agendamentos locais têm um formato inválido.");
        setAppointments(parsed.data);
      }
    } catch (error) {
      console.error("Não foi possível restaurar os agendamentos da demonstração.", error);
      setToast("Os agendamentos demonstrativos não puderam ser restaurados nesta aba.");
    } finally {
      setAppointmentsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!appointmentsReady) return;
    try {
      window.sessionStorage.setItem(APPOINTMENTS_SESSION_KEY, JSON.stringify(appointments));
    } catch (error) {
      console.error("Não foi possível manter os agendamentos durante a navegação.", error);
      setToast("A alteração foi feita, mas os agendamentos podem ser perdidos ao trocar de página.");
    }
  }, [appointments, appointmentsReady]);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(COUPONS_SESSION_KEY);
      if (saved) {
        const parsed = couponStateSchema.safeParse(JSON.parse(saved));
        if (!parsed.success) throw new Error("Os cupons locais têm um formato inválido.");
        setCoupons(parsed.data);
      }
    } catch (error) {
      console.error("Não foi possível restaurar os cupons da demonstração.", error);
      setToast("Os cupons demonstrativos não puderam ser restaurados nesta aba.");
    } finally {
      setCouponsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!couponsReady) return;
    try {
      window.sessionStorage.setItem(COUPONS_SESSION_KEY, JSON.stringify(coupons));
    } catch (error) {
      console.error("Não foi possível manter os cupons durante a navegação.", error);
      setToast("A alteração foi feita, mas os cupons podem ser perdidos ao trocar de página.");
    }
  }, [coupons, couponsReady]);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(BOOKING_RULES_SESSION_KEY);
      if (saved) {
        const parsed = bookingRulesStateSchema.safeParse(JSON.parse(saved));
        if (!parsed.success) throw new Error("As regras locais têm um formato inválido.");
        setBookingRules(parsed.data);
      }
    } catch (error) {
      console.error("Não foi possível restaurar as regras de agendamento.", error);
      setToast("As regras demonstrativas não puderam ser restauradas nesta aba.");
    } finally {
      setBookingRulesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!bookingRulesReady) return;
    try {
      window.sessionStorage.setItem(BOOKING_RULES_SESSION_KEY, JSON.stringify(bookingRules));
    } catch (error) {
      console.error("Não foi possível manter as regras durante a navegação.", error);
      setToast("A alteração foi feita, mas as regras podem ser perdidas ao trocar de página.");
    }
  }, [bookingRules, bookingRulesReady]);

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
    setBookingOptions({ businessId: initialBusinessId, step: initialBookingStep });
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
    const stepRoutes = ["empresa", "servicos", "profissional", "data", "confirmacao"];
    router.push(`/cliente/agendar/${stepRoutes[step] ?? "confirmacao"}`);
  }

  function openBooking(options: BookingOptions = {}) {
    setReschedulingId(null);
    setBookingOptions({ businessId: options.businessId ?? businessId, serviceId: options.serviceId, step: options.step ?? 0 });
    setBookingOpen(true);
  }

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  function addBooking(booking: Booking) {
    if (reschedulingId !== null) {
      const currentAppointment = appointments.find((item) => item.id === reschedulingId);
      setAppointments((current) => current.map((item) => item.id === reschedulingId
        ? { ...item, service: booking.service, professional: booking.professional, date: booking.date, time: booking.time, price: booking.price, status: currentAppointment?.status ?? item.status, presenceConfirmed: false }
        : item));
      setReschedulingId(null);
      setBookingOpen(false);
      showToast("Agendamento reagendado nesta demonstração.");
      navigate(role === "client" ? "appointments" : role === "platformAdmin" ? "businesses" : "agenda");
      return;
    }
    if (booking.couponCode) {
      setCoupons((current) => current.map((coupon) => coupon.code === booking.couponCode ? { ...coupon, usedCount: coupon.usedCount + 1 } : coupon));
    }
    const newAppointment: Appointment = {
      id: Date.now(),
      customer: booking.customer,
      business: booking.business,
      service: booking.service,
      professional: booking.professional,
      date: booking.date,
      time: booking.time,
      status: role === "client" ? "Aguardando" : "Confirmado",
      price: booking.price
    };
    setAppointments((current) => [newAppointment, ...current]);
    setBookingOpen(false);
    showToast("Solicitação registrada; aguarda confirmação da empresa nesta demonstração.");
    if (role === "client") navigate("appointments");
    else navigate("agenda");
  }

  function completeAppointment(id: number) {
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment || appointment.status === "Cancelado" || appointment.status === "Concluído") return;
    if (new Date(`${appointment.date}T${appointment.time}:00`).getTime() > Date.now()) {
      showToast("O atendimento só pode ser finalizado a partir do horário marcado.");
      return;
    }
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, status: "Concluído", paymentStatus: "pending" } : item));
    showToast("Atendimento marcado como concluído no protótipo.");
  }

  function cancelAppointment(id: number) {
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment || appointment.status === "Cancelado" || appointment.status === "Concluído") return;
    if (role === "client") {
      if (appointment.customer !== "João Almeida") {
        showToast("Você só pode cancelar seus próprios agendamentos.");
        return;
      }
      const hoursUntil = (new Date(`${appointment.date}T${appointment.time}:00`).getTime() - Date.now()) / 3_600_000;
      if (hoursUntil < bookingRules.cancelLeadHours) {
        showToast(`O cancelamento deve ser solicitado com pelo menos ${bookingRules.cancelLeadHours} horas de antecedência.`);
        return;
      }
    }
    if (!window.confirm("Deseja cancelar este agendamento?")) return;
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, status: "Cancelado" } : item));
    showToast("Agendamento cancelado nesta demonstração.");
  }

  function confirmPresence(id: number) {
    const appointment = appointments.find((item) => item.id === id);
    if (role !== "client" || !appointment || appointment.customer !== "João Almeida" || !bookingRules.checkInEnabled) return;
    const hoursUntil = (new Date(`${appointment.date}T${appointment.time}:00`).getTime() - Date.now()) / 3_600_000;
    if (hoursUntil < 0 || hoursUntil > bookingRules.checkInLeadHours) return;
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, presenceConfirmed: true } : item));
    showToast("Presença confirmada nesta demonstração.");
  }

  function rescheduleAppointment(appointment: Appointment) {
    if (appointment.status === "Concluído" || appointment.status === "Cancelado") return;
    if (role === "client") {
      if (appointment.customer !== "João Almeida") {
        showToast("Você só pode alterar seus próprios agendamentos.");
        return;
      }
      const hoursUntil = (new Date(`${appointment.date}T${appointment.time}:00`).getTime() - Date.now()) / 3_600_000;
      if (hoursUntil < bookingRules.rescheduleLeadHours) {
        showToast(`A remarcação deve ser solicitada com pelo menos ${bookingRules.rescheduleLeadHours} horas de antecedência.`);
        return;
      }
    }
    setReschedulingId(appointment.id);
    setBookingOptions({ businessId: businesses.find((item) => item.name === appointment.business)?.id ?? initialBusinessId, serviceId: services.find((item) => item.name === appointment.service)?.id, step: 2 });
    setBookingOpen(true);
  }

  function quickCreateAppointment(appointment: Omit<Appointment, "id">) {
    if (!["employee", "professional", "businessAdmin", "platformAdmin"].includes(role)) {
      showToast("Este perfil não pode criar agendamentos pela agenda da empresa.");
      return;
    }
    setAppointments((current) => [{ ...appointment, id: Date.now() }, ...current]);
    showToast("Agendamento criado nesta demonstração.");
    navigate(role === "platformAdmin" ? "businesses" : "agenda");
  }

  function markPaymentReceived(id: number, method: CashMethod) {
    if (role !== "employee" && role !== "businessAdmin") return;
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment || appointment.status !== "Concluído") {
      showToast("Só é possível registrar o pagamento depois que o atendimento foi concluído.");
      return;
    }
    setAppointments((current) => current.map((item) => item.id === id ? { ...item, paymentStatus: "received", paymentMethod: method } : item));
    showToast(`Recebimento de ${method} anotado. Nenhum pagamento foi processado pelo EFAHub.`);
  }

  const contentProps: Props = { role, view, appointments, onBook: openBooking, onToast: showToast, onComplete: completeAppointment, onMarkPayment: markPaymentReceived, onQuickCreate: quickCreateAppointment, onNavigate: navigate, onViewBusiness: navigateBusiness, businessId, favoriteBusinessIds, onToggleFavorite: toggleFavoriteBusiness, themePreference, resolvedTheme, onThemeChange: setThemePreference, onCancelAppointment: cancelAppointment, onConfirmPresence: confirmPresence, onRescheduleAppointment: rescheduleAppointment, bookingRules, onBookingRulesChange: setBookingRules, coupons, onCouponsChange: setCoupons };
  const dashboard = view === "home";

  return (
    <div className="workspace" data-role={role} data-theme={resolvedTheme}>
      {role !== "client" && <aside className="side-rail">
        <div className="rail-main">
          <Link href={defaultRoute(role)} className="rail-brand brand-lockup mb-8 px-2 text-xl font-extrabold tracking-tight text-ink no-underline"><span className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-white"><Sparkles size={18} /></span><span className="brand-copy">EFA<span className="font-medium text-[var(--accent)]">Hub</span></span></Link>
          <div className="rail-shop mb-7 flex items-center gap-3 rounded-xl border border-[#e8e9e6] px-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">{role === "platformAdmin" ? "EF" : "AA"}</span><span className="rail-shop-copy min-w-0 flex-1"><strong className="block truncate text-xs">{role === "platformAdmin" ? "EFAHub Global" : "Ateliê Aurora"}</strong><small className="mt-1 block text-[10px] text-muted">{role === "platformAdmin" ? "Console da plataforma" : "Plano profissional"}</small></span><ChevronDown className="rail-chevron text-muted" size={14} /></div>
          <p className="rail-section-label mb-2 px-3 text-[10px] font-bold tracking-[.14em] text-muted">{role === "platformAdmin" ? "PLATAFORMA" : role === "professional" ? "MEU TRABALHO" : role === "employee" ? "OPERAÇÃO" : "NEGÓCIO"}</p>
          <nav className="grid gap-1" aria-label="Navegação principal">{currentNav.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} title={label} aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)} className={`rail-nav-button flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${view === id ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[#62665f] hover:bg-[#f5f6f3]"}`}><Icon size={18} /><span className="nav-copy">{label}</span>{id === "agenda" && <span className="nav-copy ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] text-muted">{appointments.length}</span>}</button>)}</nav>
        </div>
        <button type="button" onClick={() => showToast("Ajuda e suporte demonstrativos.")} className="rail-footer flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-muted hover:bg-[#f5f6f3]"><CircleHelp size={18} /><span className="rail-footer-copy">Ajuda e suporte</span></button>
        <div className="mt-2 flex items-center gap-3 border-t border-[#ecece9] px-2 pt-4"><span className="grid size-9 place-items-center rounded-full bg-[#f7e9ed] text-xs font-bold text-[var(--accent)]">{role === "platformAdmin" ? "EF" : role === "employee" ? "FC" : "MC"}</span><span className="rail-footer-copy min-w-0 flex-1"><strong className="block truncate text-xs">{role === "platformAdmin" ? "Equipe EFAHub" : role === "employee" ? "Fernanda Costa" : role === "professional" ? "Marina Costa" : "Marina Costa"}</strong><small className="mt-1 block text-[10px] text-muted">{roleOptions.find((item) => item.id === role)?.label}</small></span><button aria-label="Sair" type="button" onClick={() => showToast("Sessão demonstrativa.")}><LogOut size={16} className="text-muted" /></button></div>
      </aside>}
      <div className="content-area">
        {role === "client" ? <header className="flex items-center justify-between border-b border-[#ebe8e3] bg-white px-5 py-3 sm:px-8"><Link href={defaultRoute(role)} className="brand-lockup text-lg font-extrabold tracking-tight text-ink no-underline"><span className="grid size-8 place-items-center rounded-lg bg-[var(--accent)] text-white"><Sparkles size={16} /></span><span>EFA<span className="font-medium text-[var(--accent)]">Hub</span></span></Link><div className="flex items-center gap-2 sm:gap-3"><select className="role-select rounded-xl border border-[#e7e5df] bg-white px-3 py-2 text-xs font-semibold" aria-label="Trocar perfil demonstrativo" value={role} onChange={(event) => changeRole(event.target.value as Role)}>{roleOptions.map((option) => <option value={option.id} key={option.id}>Demo: {option.label}</option>)}</select><ThemeCycleButton preference={themePreference} onChange={setThemePreference} /><button type="button" aria-label="Notificações" onClick={() => navigate("notifications")} className="grid size-9 place-items-center rounded-full bg-[#f7e9ed] text-ink"><Bell size={17} /></button><span className="hidden size-9 place-items-center rounded-full bg-[#f7e9ed] text-xs font-bold text-[var(--accent)] sm:grid">JA</span></div></header> : <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-[#e8e9e6] bg-white px-5 sm:px-8"><div className="flex items-center gap-3"><div className="text-xs text-muted"><span className="font-bold text-[var(--accent)]">EFAHub</span><span className="mx-2">/</span><strong className="font-semibold text-ink">{activeLabel}</strong></div></div><div className="flex items-center gap-2 sm:gap-4"><span className="hidden text-xs capitalize text-muted md:block">{todayLabel}</span><label className="hidden items-center gap-2 rounded-lg border border-[#e8e9e6] px-3 py-2 lg:flex"><Search size={15} className="text-muted" /><input className="w-28 bg-transparent text-xs outline-none placeholder:text-muted" placeholder="Buscar..." aria-label="Buscar" onKeyDown={(event) => { if (event.key === "Enter") showToast("Busca demonstrativa."); }} /><kbd className="rounded bg-[#f3f4f1] px-1.5 py-0.5 text-[10px] text-muted">⌘ K</kbd></label><ThemeCycleButton preference={themePreference} onChange={setThemePreference} /><button type="button" onClick={() => showToast("Sem notificações novas.")} aria-label="Notificações" className="relative grid size-9 place-items-center rounded-lg border border-[#e8e9e6] text-muted"><Bell size={17} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#cf765e]" /></button><select className="role-select max-w-[190px] rounded-xl border border-[#e7e5df] bg-white px-3 py-2 text-xs font-semibold" aria-label="Trocar perfil demonstrativo" value={role} onChange={(event) => changeRole(event.target.value as Role)}>{roleOptions.map((option) => <option value={option.id} key={option.id}>Demo: {option.label}</option>)}</select><button type="button" aria-label="Mais opções" onClick={() => showToast("Menu da conta demonstrativa.")} className="hidden text-muted sm:block"><MoreHorizontal size={20} /></button></div></header>}
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
      {bookingOpen && <BookingWizard key={`${bookingOptions.businessId}-${bookingOptions.serviceId}-${bookingOptions.step}-${reschedulingId ?? "new"}`} initialStep={bookingOptions.step} initialBusinessId={bookingOptions.businessId} initialServiceId={bookingOptions.serviceId} initialCustomer={appointments.find((item) => item.id === reschedulingId)?.customer} coupons={coupons} onClose={() => { setBookingOpen(false); setReschedulingId(null); navigate("home"); }} onStepChange={navigateBookingStep} onConfirm={addBooking} />}
      {toast && <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-2xl sm:bottom-6"><Check size={16} className="text-[#8fc8a8]" />{toast}<button type="button" aria-label="Fechar aviso" className="ml-2 text-white/70" onClick={() => setToast("")}><X size={15} /></button></div>}
    </div>
  );
}
