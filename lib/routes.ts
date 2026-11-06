import type { Role } from "@/lib/demo-data";
import type { ViewId } from "@/components/efahub-app";

export type ParsedWorkspaceRoute = {
  role: Role;
  view: ViewId;
  bookingStep?: number;
  businessId?: string;
};

const areas: Record<string, Role> = {
  cliente: "client",
  profissional: "professional",
  funcionario: "employee",
  empresa: "businessAdmin",
  plataforma: "platformAdmin"
};

const areaNames: Record<Role, string> = {
  client: "cliente",
  professional: "profissional",
  employee: "funcionario",
  businessAdmin: "empresa",
  platformAdmin: "plataforma"
};

export const staticWorkspacePaths = [
  "/cliente/inicio", "/cliente/buscar", "/cliente/agendamentos", "/cliente/favoritos",
  "/cliente/notificacoes", "/cliente/perfil",
  ...["atelier", "barber", "skin"].flatMap((businessId) => [
    `/cliente/empresa/${businessId}`,
    `/cliente/empresa/${businessId}/servicos`
  ]),
  ...["empresa", "servicos", "profissional", "data", "horario", "confirmacao"].map((step) => `/cliente/agendar/${step}`),
  "/profissional/inicio", "/profissional/agenda/dia", "/profissional/agenda/semana",
  "/profissional/atendimentos", "/profissional/clientes", "/profissional/comissoes", "/profissional/perfil",
  "/funcionario/inicio", "/funcionario/agenda", "/funcionario/agendamentos/novo",
  "/funcionario/clientes", "/funcionario/clientes/novo", "/funcionario/check-in", "/funcionario/caixa",
  "/empresa/inicio", "/empresa/agenda", "/empresa/clientes", "/empresa/profissionais",
  "/empresa/servicos", "/empresa/financeiro", "/empresa/relatorios", "/empresa/marketing",
  "/empresa/estoque", "/empresa/configuracoes", "/empresa/agendamentos/novo",
  "/plataforma/inicio", "/plataforma/empresas", "/plataforma/assinaturas",
  "/plataforma/financeiro", "/plataforma/suporte", "/plataforma/auditoria"
] as const;

export function defaultRoute(role: Role) {
  return `/${areaNames[role]}/inicio`;
}

export function viewRoute(role: Role, view: ViewId) {
  const paths: Record<Role, Partial<Record<ViewId, string>>> = {
    client: { home: "inicio", search: "buscar", business: "empresa/atelier", companyServices: "empresa/atelier/servicos", appointments: "agendamentos", favorites: "favoritos", notifications: "notificacoes", profile: "perfil" },
    professional: { home: "inicio", agenda: "agenda/dia", clients: "clientes", earnings: "comissoes", profile: "perfil" },
    employee: { home: "inicio", agenda: "agenda", clients: "clientes", checkin: "check-in", payments: "caixa", newBooking: "agendamentos/novo", newClient: "clientes/novo" },
    businessAdmin: { home: "inicio", agenda: "agenda", clients: "clientes", team: "profissionais", services: "servicos", finance: "financeiro", reports: "relatorios", marketing: "marketing", inventory: "estoque", settings: "configuracoes", newBooking: "agendamentos/novo" },
    platformAdmin: { home: "inicio", businesses: "empresas", subscriptions: "assinaturas", finance: "financeiro", support: "suporte", audit: "auditoria" }
  };
  return `/${areaNames[role]}/${paths[role][view] ?? "inicio"}`;
}

const bookingRoutes = ["empresa", "servicos", "profissional", "data", "horario", "confirmacao"];

export function parseWorkspaceRoute(area: string, segments: string[] = []): ParsedWorkspaceRoute | null {
  const role = areas[area];
  if (!role) return null;
  const path = segments.join("/");

  if (role === "client") {
    const bookingIndex = segments[0] === "agendar" ? bookingRoutes.indexOf(segments[1] ?? "") : -1;
    if (bookingIndex >= 0) return { role, view: "home", bookingStep: bookingIndex };
    if (segments[0] === "buscar") return { role, view: "search" };
    if (segments[0] === "empresa" && segments.length >= 2) return { role, view: segments.length >= 3 && segments[2] === "servicos" ? "companyServices" : "business", businessId: segments[1] };
    if (["inicio", "favoritos"].includes(segments[0] ?? "")) return { role, view: segments[0] === "favoritos" ? "favorites" : "home" };
    if (path === "agendamentos") return { role, view: "appointments" };
    if (["perfil", "configuracoes"].includes(segments[0] ?? "")) return { role, view: "profile" };
    if (path === "notificacoes") return { role, view: "notifications" };
  }

  if (role === "professional") {
    if (segments[0] === "inicio") return { role, view: "home" };
    if (segments[0] === "agenda") return { role, view: "agenda" };
    if (segments[0] === "atendimentos") return { role, view: "appointments" };
    if (segments[0] === "clientes") return { role, view: "clients" };
    if (segments[0] === "comissoes") return { role, view: "earnings" };
    if (segments[0] === "perfil") return { role, view: "profile" };
  }

  if (role === "employee") {
    if (segments[0] === "inicio") return { role, view: "home" };
    if (segments[0] === "agenda") return { role, view: "agenda" };
    if (segments[0] === "agendamentos") return { role, view: segments[1] === "novo" ? "newBooking" : "agenda" };
    if (segments[0] === "clientes" && segments[1] === "novo") return { role, view: "newClient" };
    if (segments[0] === "clientes") return { role, view: "clients" };
    if (segments[0] === "check-in") return { role, view: "checkin" };
    if (segments[0] === "caixa") return { role, view: "payments" };
  }

  if (role === "businessAdmin") {
    if (path === "agendamentos/novo") return { role, view: "newBooking" };
    const views: Record<string, ViewId> = {
      inicio: "home", agenda: "agenda", clientes: "clients", profissionais: "team", servicos: "services",
      financeiro: "finance", relatorios: "reports", marketing: "marketing", estoque: "inventory", configuracoes: "settings"
    };
    if (views[segments[0] ?? ""]) return { role, view: views[segments[0]] };
  }

  if (role === "platformAdmin") {
    const views: Record<string, ViewId> = {
      inicio: "home", empresas: "businesses", assinaturas: "subscriptions", financeiro: "finance", suporte: "support", auditoria: "audit"
    };
    if (views[segments[0] ?? ""]) return { role, view: views[segments[0]] };
  }

  return segments.length === 0 ? { role, view: "home" } : null;
}
