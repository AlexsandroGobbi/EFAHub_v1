"use strict";

const STORAGE_KEY = "barberflow-demo-v1";
const THEME_STORAGE_KEY = "efahub-theme-v1";
const DEFAULT_SERVICES = [
  { id: "service-cut", name: "Corte tradicional", description: "Corte clássico personalizado.", price: 45, duration: 45, active: true, staffIds: [] },
  { id: "service-beard", name: "Barba", description: "Aparar e finalizar a barba.", price: 30, duration: 30, active: true, staffIds: [] },
  { id: "service-combo", name: "Corte + barba", description: "Corte tradicional com acabamento de barba.", price: 65, duration: 60, active: true, staffIds: [] }
];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DEFAULT_BUSINESS_HOURS = Object.fromEntries(DAY_KEYS.map((day) => [day, { open: true, start: "08:00", end: "21:00" }]));
const state = {
  shopName: "Barbearia Demo",
  businessCategory: "barbershop",
  publicSlug: "barbearia-demo",
  onlineBookingEnabled: false,
  shopLogo: "",
  professional: { name: "", phone: "", bio: "" },
  shopContact: { phone: "", address: "", instagram: "", supportUrl: "", termsUrl: "", privacyUrl: "" },
  businessHours: structuredClone(DEFAULT_BUSINESS_HOURS),
  staff: [],
  commissionPayments: [],
  services: structuredClone(DEFAULT_SERVICES),
  appointments: [],
  products: [],
  inventoryMovements: [],
  sales: [],
  waitlist: [],
  supportTickets: [],
  activity: [],
  selectedDate: toDateInputValue(new Date())
};
let dashboardPeriod = "month";
let teamSort = "revenue";
let commandActiveIndex = 0;
let toastTimer;
let staffDraftBlocks = [];

const elements = {
  overview: document.querySelector("#overview-view"),
  agenda: document.querySelector("#agenda-view"),
  services: document.querySelector("#services-view"),
  team: document.querySelector("#team-view"),
  settings: document.querySelector("#settings-view"),
  appointmentDialog: document.querySelector("#appointment-dialog"),
  appointmentForm: document.querySelector("#appointment-form"),
  appointmentError: document.querySelector("#appointment-error"),
  serviceDialog: document.querySelector("#service-dialog"),
  serviceForm: document.querySelector("#service-form"),
  serviceError: document.querySelector("#service-error"),
  commissionPaymentDialog: document.querySelector("#commission-payment-dialog"),
  commissionPaymentForm: document.querySelector("#commission-payment-form"),
  agendaDate: document.querySelector("#agenda-date"),
  toast: document.querySelector("#toast")
};

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function currency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch (error) {
    console.error("Não foi possível carregar a preferência de aparência.", error);
    return "dark";
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  });
  const nextTheme = theme === "dark" ? "light" : "dark";
  const nextThemeLabel = nextTheme === "light" ? "claro" : "escuro";
  document.querySelector("#theme-toggle-icon").textContent = theme === "dark" ? "☼" : "☾";
  document.querySelector("#theme-toggle").setAttribute("aria-label", `Ativar tema ${nextThemeLabel}`);
  document.querySelector("#theme-toggle").title = `Ativar tema ${nextThemeLabel}`;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#080808" : "#f5f3ef";
}

function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.error("Não foi possível salvar a preferência de aparência.", error);
    showToast("O tema foi alterado, mas não foi possível salvar essa preferência neste navegador.");
  }
}

function parseDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLongDate(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parseDate(dateValue));
}

function formatShortDate(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(parseDate(dateValue));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const data = JSON.parse(saved);
    if (!data || !Array.isArray(data.services) || !Array.isArray(data.appointments) || typeof data.shopName !== "string") {
      throw new Error("Os dados salvos não correspondem ao formato esperado.");
    }
    state.shopName = data.shopName.slice(0, 60) || "Barbearia Demo";
    state.businessCategory = ["beauty", "barbershop", "aesthetics", "brows", "nails", "health", "fitness", "education", "other"].includes(data.businessCategory) ? data.businessCategory : "barbershop";
    state.publicSlug = normalizeSlug(data.publicSlug || state.shopName);
    state.onlineBookingEnabled = data.onlineBookingEnabled === true;
    state.shopLogo = isValidLogo(data.shopLogo) ? data.shopLogo : "";
    state.professional = normalizeProfile(data.professional);
    state.shopContact = normalizeShopContact(data.shopContact);
    state.businessHours = normalizeBusinessHours(data.businessHours);
    state.staff = Array.isArray(data.staff) ? data.staff.filter(isValidStaffMember).map(normalizeStaffMember) : [];
    state.commissionPayments = Array.isArray(data.commissionPayments) ? data.commissionPayments.filter(isValidCommissionPayment) : [];
    state.services = data.services.filter(isValidService).map(normalizeService);
    state.appointments = data.appointments.filter(isValidAppointment);
    state.products = Array.isArray(data.products) ? data.products.filter(isValidProduct) : [];
    state.inventoryMovements = Array.isArray(data.inventoryMovements) ? data.inventoryMovements.filter(isValidInventoryMovement).slice(-500) : [];
    state.sales = Array.isArray(data.sales) ? data.sales.filter(isValidSale).slice(-500) : [];
    state.waitlist = Array.isArray(data.waitlist) ? data.waitlist.filter(isValidWaitlistEntry).slice(-300) : [];
    state.supportTickets = Array.isArray(data.supportTickets) ? data.supportTickets.filter(isValidSupportTicket).slice(-200) : [];
    state.activity = Array.isArray(data.activity) ? data.activity.filter(isValidActivity).slice(-80) : [];
  } catch (error) {
    console.error("Não foi possível carregar os dados locais da demonstração.", error);
    showToast("Não foi possível ler os dados salvos. A demonstração será iniciada com dados vazios.");
  }
}

function isValidLogo(value) {
  return typeof value === "string" && /^data:image\/(webp|png|jpeg);base64,/.test(value) && value.length < 1_500_000;
}

function normalizeProfile(profile) {
  return {
    name: typeof profile?.name === "string" ? profile.name.slice(0, 80) : "",
    phone: typeof profile?.phone === "string" ? profile.phone.slice(0, 20) : "",
    bio: typeof profile?.bio === "string" ? profile.bio.slice(0, 240) : ""
  };
}

function normalizeShopContact(contact) {
  return {
    phone: typeof contact?.phone === "string" ? contact.phone.slice(0, 20) : "",
    address: typeof contact?.address === "string" ? contact.address.slice(0, 140) : "",
    instagram: safeExternalUrl(contact?.instagram),
    supportUrl: safeExternalUrl(contact?.supportUrl),
    termsUrl: safeExternalUrl(contact?.termsUrl),
    privacyUrl: safeExternalUrl(contact?.privacyUrl)
  };
}

function normalizeSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "efa-negocio";
}

function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.href.length <= 200 ? url.href : "";
  } catch {
    return "";
  }
}

function normalizeBusinessHours(hours) {
  return Object.fromEntries(DAY_KEYS.map((day) => {
    const saved = hours?.[day];
    const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const fallback = DEFAULT_BUSINESS_HOURS[day];
    return [day, {
      open: typeof saved?.open === "boolean" ? saved.open : fallback.open,
      start: validTime(saved?.start) ? saved.start : fallback.start,
      end: validTime(saved?.end) ? saved.end : fallback.end
    }];
  }));
}

function isValidStaffMember(member) {
  return member && typeof member.id === "string" && typeof member.name === "string"
    && typeof member.role === "string" && typeof member.phone === "string";
}

function normalizeStaffMember(member) {
  const validPhoto = typeof member.photo === "string" && /^data:image\/(webp|png|jpeg);base64,/.test(member.photo) && member.photo.length < 300_000;
  const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const rate = Number(member.commissionRate);
  return {
    id: member.id,
    name: member.name.slice(0, 80),
    role: member.role.slice(0, 60),
    phone: member.phone.slice(0, 20),
    email: typeof member.email === "string" ? member.email.slice(0, 120) : "",
    photo: validPhoto ? member.photo : "",
    joinedAt: validDate(member.joinedAt) ? member.joinedAt : "",
    active: typeof member.active === "boolean" ? member.active : true,
    commissionRate: Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 0,
    commissionType: member.commissionType === "fixed" ? "fixed" : "percentage",
    commissionValue: Number.isFinite(Number(member.commissionValue))
      ? Math.max(0, Number(member.commissionValue))
      : Number.isFinite(rate) ? Math.max(0, rate) : 0,
    inheritsBusinessHours: typeof member.inheritsBusinessHours === "boolean" ? member.inheritsBusinessHours : true,
    schedule: normalizeStaffSchedule(member.schedule),
    blocks: Array.isArray(member.blocks) ? member.blocks.filter(isValidStaffBlock).slice(-100) : []
  };
}

function normalizeStaffSchedule(schedule) {
  return Object.fromEntries(DAY_KEYS.map((day) => {
    const saved = schedule?.[day];
    const business = state.businessHours[day] || DEFAULT_BUSINESS_HOURS[day];
    const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    return [day, {
      open: typeof saved?.open === "boolean" ? saved.open : business.open,
      start: validTime(saved?.start) ? saved.start : business.start,
      end: validTime(saved?.end) ? saved.end : business.end,
      breakStart: validTime(saved?.breakStart) ? saved.breakStart : "",
      breakEnd: validTime(saved?.breakEnd) ? saved.breakEnd : ""
    }];
  }));
}

function isValidStaffBlock(block) {
  const validTime = (value) => value === "" || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
  return block && typeof block.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(block.date)
    && validTime(block.start) && validTime(block.end) && Boolean(block.start) === Boolean(block.end)
    && (!block.start || timeToMinutes(block.start) < timeToMinutes(block.end))
    && typeof block.note === "string";
}

function isValidCommissionPayment(payment) {
  return payment && typeof payment.id === "string" && typeof payment.staffId === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(payment.paidAt)
    && Array.isArray(payment.lines)
    && payment.lines.every((line) => typeof line.appointmentId === "string" && Number.isFinite(line.amount) && line.amount >= 0);
}

function isValidService(service) {
  return service && typeof service.id === "string" && typeof service.name === "string"
    && Number.isFinite(service.price) && Number.isFinite(service.duration);
}

function normalizeService(service) {
  return {
    id: service.id,
    name: service.name.slice(0, 60),
    description: typeof service.description === "string" ? service.description.slice(0, 240) : "",
    price: service.price,
    duration: service.duration,
    active: service.active !== false,
    staffIds: Array.isArray(service.staffIds) ? [...new Set(service.staffIds.filter((id) => typeof id === "string"))] : []
  };
}

function isValidAppointment(appointment) {
  return appointment && typeof appointment.id === "string"
    && typeof appointment.customerName === "string"
    && typeof appointment.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(appointment.date)
    && typeof appointment.time === "string"
    && /^\d{2}:\d{2}$/.test(appointment.time)
    && ["scheduled", "completed", "cancelled"].includes(appointment.status)
    && Number.isFinite(appointment.price) && Number.isFinite(appointment.duration);
}

function isValidProduct(product) {
  return product && typeof product.id === "string" && typeof product.name === "string"
    && typeof product.sku === "string" && Number.isFinite(product.price) && product.price >= 0
    && (product.cost === null || Number.isFinite(product.cost))
    && Number.isInteger(product.stock) && product.stock >= 0
    && Number.isInteger(product.minStock) && product.minStock >= 0;
}

function isValidInventoryMovement(movement) {
  return movement && typeof movement.id === "string" && typeof movement.productId === "string"
    && ["initial", "in", "out", "sale", "refund"].includes(movement.type)
    && Number.isInteger(movement.quantity) && movement.quantity > 0
    && typeof movement.createdAt === "string" && Number.isFinite(Date.parse(movement.createdAt));
}

function isValidSale(sale) {
  return sale && typeof sale.id === "string" && typeof sale.productId === "string"
    && Number.isInteger(sale.quantity) && sale.quantity > 0
    && Number.isFinite(sale.total) && sale.total >= 0
    && ["cash", "pix", "card", "receivable"].includes(sale.paymentMethod)
    && ["received", "pending", "refunded"].includes(sale.paymentStatus)
    && typeof sale.createdAt === "string" && Number.isFinite(Date.parse(sale.createdAt));
}

function isValidWaitlistEntry(entry) {
  return entry && typeof entry.id === "string" && typeof entry.customerName === "string"
    && typeof entry.serviceId === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.preferredDate)
    && ["waiting", "booked"].includes(entry.status)
    && typeof entry.createdAt === "string" && Number.isFinite(Date.parse(entry.createdAt));
}

function isValidSupportTicket(ticket) {
  return ticket && typeof ticket.id === "string" && typeof ticket.category === "string"
    && typeof ticket.message === "string" && ["local"].includes(ticket.status)
    && typeof ticket.createdAt === "string" && Number.isFinite(Date.parse(ticket.createdAt));
}

function isValidActivity(activity) {
  return activity && typeof activity.id === "string" && typeof activity.type === "string"
    && typeof activity.message === "string" && typeof activity.createdAt === "string"
    && Number.isFinite(Date.parse(activity.createdAt));
}

function recordActivity(type, message, appointmentId = "") {
  state.activity.push({
    id: crypto.randomUUID(),
    type,
    message: message.slice(0, 180),
    appointmentId,
    createdAt: new Date().toISOString()
  });
  state.activity = state.activity.slice(-80);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      shopName: state.shopName,
      businessCategory: state.businessCategory,
      publicSlug: state.publicSlug,
      onlineBookingEnabled: state.onlineBookingEnabled,
      shopLogo: state.shopLogo,
      professional: state.professional,
      shopContact: state.shopContact,
      businessHours: state.businessHours,
      staff: state.staff,
      commissionPayments: state.commissionPayments,
      services: state.services,
      appointments: state.appointments,
      products: state.products,
      inventoryMovements: state.inventoryMovements,
      sales: state.sales,
      waitlist: state.waitlist,
      supportTickets: state.supportTickets,
      activity: state.activity
    }));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os dados locais da demonstração.", error);
    showToast("Não foi possível salvar. Verifique as permissões e o espaço disponível no navegador.");
    return false;
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 3300);
}

function showError(element, message) {
  element.textContent = message;
  element.classList.remove("hidden");
}

function clearError(element) {
  element.textContent = "";
  element.classList.add("hidden");
}

function activeAppointmentsFor(dateValue) {
  return state.appointments
    .filter((appointment) => appointment.date === dateValue)
    .sort((first, second) => first.time.localeCompare(second.time));
}

function serviceForAppointment(appointment) {
  return state.services.find((service) => service.id === appointment.serviceId);
}

function statusLabel(status) {
  return { scheduled: "Confirmado", completed: "Concluído", cancelled: "Cancelado" }[status] || "Confirmado";
}

function appointmentRow(appointment) {
  const service = serviceForAppointment(appointment);
  const serviceName = service ? service.name : appointment.serviceName || "Serviço removido";
  return `<div class="appointment-row">
    <div class="appointment-time">${escapeHtml(appointment.time)}</div>
    <div class="appointment-main">
      <strong>${escapeHtml(appointment.customerName)}</strong>
      <span>${escapeHtml(serviceName)} · <span class="status-pill ${appointment.status}">${statusLabel(appointment.status)}</span></span>
    </div>
    <div class="appointment-price">${currency(appointment.price)}</div>
  </div>`;
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function shiftDate(date, days) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

function getDashboardRange(period = dashboardPeriod, customStart, customEnd) {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let start;
  let end;
  if (period === "today") start = end = base;
  else if (period === "week") {
    start = startOfWeek(base);
    end = shiftDate(start, 6);
  } else if (period === "quarter") {
    const firstMonth = Math.floor(base.getMonth() / 3) * 3;
    start = new Date(base.getFullYear(), firstMonth, 1);
    end = new Date(base.getFullYear(), firstMonth + 3, 0);
  } else if (period === "year") {
    start = new Date(base.getFullYear(), 0, 1);
    end = new Date(base.getFullYear(), 11, 31);
  } else if (period === "custom" && customStart && customEnd && customStart <= customEnd) {
    start = parseDate(customStart);
    end = parseDate(customEnd);
  } else {
    start = new Date(base.getFullYear(), base.getMonth(), 1);
    end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  }
  const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
  return {
    start,
    end,
    startKey: toDateInputValue(start),
    endKey: toDateInputValue(end),
    days,
    label: `${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(start)} – ${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(end)}`
  };
}

function previousRange(range) {
  const end = shiftDate(range.start, -1);
  const start = shiftDate(end, -(range.days - 1));
  return { start, end, startKey: toDateInputValue(start), endKey: toDateInputValue(end) };
}

function appointmentsInRange(range) {
  return state.appointments.filter((item) => item.date >= range.startKey && item.date <= range.endKey);
}

function completedAppointments(appointments) {
  return appointments.filter((item) => item.status === "completed");
}

function serviceValue(appointments) {
  return completedAppointments(appointments).reduce((total, item) => total + item.price, 0);
}

function customerKey(appointment) {
  const phone = normalizePhone(appointment.customerPhone || "");
  return phone
    ? `phone:${phone}`
    : `name:${appointment.customerName.trim().toLocaleLowerCase("pt-BR")}`;
}

function customerStats(appointments, range) {
  const history = completedAppointments(appointments).slice().sort((a, b) => a.date.localeCompare(b.date));
  const selectedHistory = history.filter((item) => item.date >= range.startKey && item.date <= range.endKey);
  const allByCustomer = new Map();
  const selectedByCustomer = new Map();
  for (const appointment of history) {
    const key = customerKey(appointment);
    if (!key) continue;
    allByCustomer.set(key, [...(allByCustomer.get(key) || []), appointment]);
    if (appointment.date >= range.startKey && appointment.date <= range.endKey) {
      selectedByCustomer.set(key, [...(selectedByCustomer.get(key) || []), appointment]);
    }
  }
  const firstInPeriod = new Set();
  for (const [key, historyForCustomer] of allByCustomer) {
    if (historyForCustomer[0].date >= range.startKey && historyForCustomer[0].date <= range.endKey) firstInPeriod.add(key);
  }
  const repeat = [...allByCustomer.values()].filter((items) => items.length > 1).length;
  const cutoff = toDateInputValue(new Date());
  const lastVisits = [...allByCustomer.entries()].map(([key, visits]) => ({ key, date: visits[visits.length - 1].date }));
  const daysSince = (date) => Math.floor((parseDate(cutoff) - parseDate(date)) / 86_400_000);
  return {
    newCount: firstInPeriod.size,
    repeatCount: repeat,
    activeCount: selectedByCustomer.size,
    inactive30: lastVisits.filter((item) => daysSince(item.date) > 30).length,
    inactive60: lastVisits.filter((item) => daysSince(item.date) > 60).length,
    inactive90: lastVisits.filter((item) => daysSince(item.date) > 90).length,
    vipCount: [...allByCustomer.values()].filter((visits) => visits.length >= 3).length,
    selectedHistory
  };
}

function capacityStats(appointments, range) {
  const activeStaff = state.staff.filter((member) => member.active);
  let availableMinutes = activeStaff.reduce((total, member) => total + staffAvailableMinutes(member, toDateInputValue(range.start), toDateInputValue(range.end)), 0);
  if (!activeStaff.length) {
    for (let date = new Date(range.start); date <= range.end; date = shiftDate(date, 1)) {
      const hours = state.businessHours[DAY_KEYS[date.getDay()]];
      if (hours.open) availableMinutes += timeToMinutes(hours.end) - timeToMinutes(hours.start);
    }
  }
  const occupiedMinutes = appointments
    .filter((item) => item.status !== "cancelled")
    .reduce((total, item) => total + item.duration, 0);
  return {
    availableMinutes,
    occupiedMinutes,
    percent: availableMinutes ? Math.min(100, Math.round(occupiedMinutes / availableMinutes * 100)) : null
  };
}

function changeLabel(current, previous, formatter) {
  if (!previous) return current ? "Sem base anterior para comparar" : "Sem histórico comparável";
  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? "↑" : change < 0 ? "↓" : "→";
  return `${direction} ${Math.abs(change).toFixed(1).replace(".", ",")}% vs. período anterior (${formatter(previous)})`;
}

function sparkline(values, label) {
  if (!values.some((value) => value > 0)) return `<div class="sparkline-empty">Sem histórico neste período</div>`;
  const width = 112;
  const height = 32;
  const maximum = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : 2 + index * (width - 4) / (values.length - 1);
    const y = height - 3 - value / maximum * (height - 7);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="kpi-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function dailyTrend(appointments, range, metric) {
  const bucketCount = Math.min(8, range.days);
  const buckets = Array.from({ length: bucketCount }, () => 0);
  for (const appointment of appointments) {
    if (appointment.status !== "completed") continue;
    const offset = Math.floor((parseDate(appointment.date) - range.start) / 86_400_000);
    const bucket = Math.min(bucketCount - 1, Math.floor(offset / range.days * bucketCount));
    buckets[bucket] += metric === "value" ? appointment.price : 1;
  }
  return buckets;
}

function renderKpis(appointments, previousAppointments, range) {
  const nowKey = toDateInputValue(new Date());
  const nowTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
  const completed = completedAppointments(appointments);
  const previousCompleted = completedAppointments(previousAppointments);
  const customer = customerStats(state.appointments, range);
  const previousRangeValue = previousRange(range);
  const previousCustomer = customerStats(state.appointments, previousRangeValue);
  const capacity = capacityStats(appointments, range);
  const previousCapacity = capacityStats(previousAppointments, previousRangeValue);
  const future = appointments.filter((item) => item.status === "scheduled" && (item.date > nowKey || (item.date === nowKey && item.time >= nowTime)));
  const previousFuture = previousAppointments.filter((item) => item.status === "scheduled");
  const bookingTotal = appointments.length;
  const previousBookingTotal = previousAppointments.length;
  const cancellations = bookingTotal ? appointments.filter((item) => item.status === "cancelled").length / bookingTotal * 100 : 0;
  const previousCancellations = previousBookingTotal ? previousAppointments.filter((item) => item.status === "cancelled").length / previousBookingTotal * 100 : 0;
  const currentValue = serviceValue(appointments);
  const previousValue = serviceValue(previousAppointments);
  const avgTicket = completed.length ? currentValue / completed.length : 0;
  const previousTicket = previousCompleted.length ? previousValue / previousCompleted.length : 0;
  const formatCount = (value) => String(value);
  const data = [
    { title: "Serviços concluídos", value: currency(currentValue), compare: changeLabel(currentValue, previousValue, currency), trend: dailyTrend(appointments, range, "value"), format: currency, desc: "Soma dos preços registrados em atendimentos concluídos. Não confirma pagamento recebido.", key: "value" },
    { title: "Receita recebida", value: "—", compare: "Sem registro de pagamentos", trend: null, desc: "O sistema ainda não registra confirmação de recebimentos.", key: "unavailable" },
    { title: "Receita pendente", value: "—", compare: "Sem status financeiro", trend: null, desc: "O sistema ainda não registra valores pendentes de pagamento.", key: "unavailable" },
    { title: "Atendimentos concluídos", value: formatCount(completed.length), compare: changeLabel(completed.length, previousCompleted.length, formatCount), trend: dailyTrend(appointments, range, "count"), desc: "Agendamentos com status concluído no período selecionado.", key: "count" },
    { title: "Agendamentos futuros", value: formatCount(future.length), compare: `${appointments.filter((item) => item.status === "scheduled").length} reservas ativas no período`, trend: null, desc: "Reservas confirmadas ainda não atendidas, dentro do período.", key: "count" },
    { title: "Ticket médio", value: completed.length ? currency(avgTicket) : "—", compare: changeLabel(avgTicket, previousTicket, currency), trend: dailyTrend(appointments, range, "value"), desc: "Valor registrado em serviços concluídos dividido pela quantidade concluída.", key: "value" },
    { title: "Ocupação da agenda", value: capacity.percent === null ? "—" : `${capacity.percent}%`, compare: previousCapacity.percent === null ? "Sem horário disponível no período anterior" : `${previousCapacity.percent}% no período anterior`, trend: null, desc: "Duração total de reservas não canceladas ÷ minutos de atendimento configurados.", key: "percent" },
    { title: "Taxa de cancelamento", value: bookingTotal ? `${cancellations.toFixed(1).replace(".", ",")}%` : "—", compare: previousBookingTotal ? `${previousCancellations.toFixed(1).replace(".", ",")}% no período anterior` : "Sem base anterior", trend: null, desc: "Agendamentos cancelados ÷ total de agendamentos no período.", key: "percent" },
    { title: "Não comparecimentos", value: "—", compare: "Status ainda não disponível", trend: null, desc: "O registro de não comparecimento não faz parte desta versão.", key: "unavailable" },
    { title: "Clientes recorrentes", value: formatCount(customer.repeatCount), compare: "Histórico total de atendimentos concluídos", trend: null, desc: "Clientes identificados preferencialmente pelo celular; reservas sem telefone usam o nome e podem não representar a mesma pessoa.", key: "count" },
    { title: "Novos clientes", value: formatCount(customer.newCount), compare: "Primeiro atendimento concluído dentro do período", trend: null, desc: "Primeiro atendimento concluído por cliente identificado por telefone, com fallback para nome quando não há telefone.", key: "count" },
    { title: "Clientes ativos", value: formatCount(customer.activeCount), compare: "Com atendimento concluído no período", trend: null, desc: "Clientes identificados por telefone, com fallback para nome, com atendimento concluído neste período.", key: "count" }
  ];
  document.querySelector("#kpi-grid").innerHTML = data.map((item, index) => {
    const chart = item.trend ? sparkline(item.trend, `Tendência de ${item.title}`) : `<div class="sparkline-empty">${item.key === "unavailable" ? "Dado indisponível" : "Sem série temporal"}</div>`;
    return `<article class="kpi-card ${item.key === "unavailable" ? "kpi-unavailable" : ""}">
      <div class="kpi-heading"><span>${escapeHtml(item.title)}</span><button class="info-button" data-action="toggle-kpi" type="button" aria-label="Detalhes: ${escapeHtml(item.title)}" aria-expanded="false" title="Ver definição da métrica">ⓘ</button></div>
      <strong class="kpi-value">${escapeHtml(item.value)}</strong>
      <span class="kpi-comparison">${escapeHtml(item.compare)}</span>
      <div class="kpi-bottom">${chart}<span class="kpi-index">${String(index + 1).padStart(2, "0")}</span></div>
      <p class="kpi-detail hidden">${escapeHtml(item.desc)}</p>
    </article>`;
  }).join("");
}

function renderRevenueChart(appointments, range) {
  const target = document.querySelector("#revenue-chart");
  const completed = completedAppointments(appointments);
  if (!completed.length) {
    target.innerHTML = `<div class="chart-empty"><span class="empty-chart-icon">⌁</span><strong>Sem serviços concluídos neste período</strong><span>Conclua atendimentos para visualizar a evolução.</span></div>`;
    return;
  }
  const bucketCount = Math.min(12, range.days);
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    value: 0,
    start: Math.floor(index * range.days / bucketCount),
    end: Math.floor((index + 1) * range.days / bucketCount) - 1
  }));
  completed.forEach((appointment) => {
    const offset = Math.floor((parseDate(appointment.date) - range.start) / 86_400_000);
    const index = Math.min(bucketCount - 1, Math.floor(offset / range.days * bucketCount));
    buckets[index].value += appointment.price;
  });
  const width = 720;
  const height = 220;
  const left = 44;
  const right = 12;
  const top = 16;
  const bottom = 32;
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  const points = buckets.map((bucket, index) => ({
    x: left + (bucketCount === 1 ? (width - left - right) / 2 : index * (width - left - right) / (bucketCount - 1)),
    y: top + (1 - bucket.value / max) * (height - top - bottom),
    ...bucket
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${left},${height - bottom} ${line} ${width - right},${height - bottom}`;
  const grid = [0, .5, 1].map((fraction) => {
    const y = top + fraction * (height - top - bottom);
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#302d29" stroke-dasharray="3 5"/><text x="0" y="${y + 4}" fill="#88847d" font-size="10">${currency(max * (1 - fraction)).replace(",00", "")}</text>`;
  }).join("");
  const labels = points.map((point, index) => {
    if (bucketCount > 7 && index % Math.ceil(bucketCount / 6) !== 0 && index !== bucketCount - 1) return "";
    const bucketDate = shiftDate(range.start, point.start);
    const label = range.days > 40
      ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(bucketDate)
      : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(bucketDate);
    return `<text x="${point.x}" y="${height - 7}" text-anchor="middle" fill="#929087" font-size="9">${escapeHtml(label)}</text>`;
  }).join("");
  const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3" fill="#a888ff"><title>${escapeHtml(currency(point.value))}</title></circle>`).join("");
  target.innerHTML = `<svg class="revenue-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Valor dos serviços concluídos por dia no período">${grid}<polygon points="${area}" fill="url(#chart-fill)"/><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a888ff" stop-opacity=".24"/><stop offset="1" stop-color="#a888ff" stop-opacity="0"/></linearGradient></defs><polyline points="${line}" fill="none" stroke="#a888ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

function renderBreakdown(appointments) {
  const completed = completedAppointments(appointments);
  const totals = new Map();
  completed.forEach((appointment) => {
    const name = serviceForAppointment(appointment)?.name || appointment.serviceName || "Serviço removido";
    const entry = totals.get(name) || { count: 0, value: 0 };
    entry.count += 1;
    entry.value += appointment.price;
    totals.set(name, entry);
  });
  const rows = [...totals.entries()].sort((a, b) => b[1].value - a[1].value);
  const target = document.querySelector("#service-breakdown");
  if (!rows.length) {
    target.innerHTML = `<div class="mini-empty">Sem atendimentos concluídos para comparar serviços.</div>`;
    return;
  }
  const total = rows.reduce((sum, [, value]) => sum + value.value, 0);
  target.innerHTML = rows.slice(0, 5).map(([name, value], index) => `<div class="breakdown-row">
    <span class="breakdown-dot dot-${index + 1}"></span><span class="breakdown-name">${escapeHtml(name)}<small>${value.count} atendimento(s)</small></span>
    <span class="breakdown-value">${currency(value.value)}<small>${total ? Math.round(value.value / total * 100) : 0}%</small></span>
  </div>`).join("");
}

function renderServiceRanking(appointments) {
  const completed = completedAppointments(appointments);
  const byService = new Map();
  completed.forEach((appointment) => {
    const service = serviceForAppointment(appointment);
    const name = service?.name || appointment.serviceName || "Serviço removido";
    const entry = byService.get(name) || { count: 0, value: 0, minutes: 0, durations: 0 };
    entry.count += 1;
    entry.value += appointment.price;
    entry.minutes += appointment.duration;
    entry.durations += 1;
    byService.set(name, entry);
  });
  const rows = [...byService.entries()].sort((a, b) => b[1].count - a[1].count);
  const target = document.querySelector("#service-ranking");
  if (!rows.length) {
    target.innerHTML = `<div class="mini-empty">O ranking aparecerá quando houver serviços concluídos.</div>`;
    return;
  }
  const maxCount = rows[0][1].count;
  target.innerHTML = rows.map(([name, item], index) => `<div class="ranking-row">
    <span class="ranking-number">${String(index + 1).padStart(2, "0")}</span>
    <div class="ranking-main"><div class="ranking-label"><strong>${escapeHtml(name)}</strong><span>${item.count} atend.</span></div>
    <div class="ranking-track"><span style="width:${Math.max(4, item.count / maxCount * 100)}%"></span></div>
    <small>${currency(item.value)} · ticket ${currency(item.value / item.count)} · ${Math.round(item.minutes / item.durations)} min médios</small></div>
  </div>`).join("");
}

function renderCapacity(appointments, range) {
  const capacity = capacityStats(appointments, range);
  const percent = capacity.percent;
  document.querySelector("#capacity-summary").innerHTML = percent === null
    ? `<div class="mini-empty">Configure os horários de atendimento para calcular a capacidade.</div>`
    : `<div class="capacity-meter" style="--capacity:${percent}%"><div class="capacity-center"><strong>${percent}%</strong><span>ocupação</span></div></div>
      <div class="capacity-details"><div><span class="capacity-dot occupied"></span><span>Tempo reservado</span><strong>${Math.floor(capacity.occupiedMinutes / 60)}h ${capacity.occupiedMinutes % 60}m</strong></div>
      <div><span class="capacity-dot available"></span><span>Disponível no período</span><strong>${Math.floor(Math.max(0, capacity.availableMinutes - capacity.occupiedMinutes) / 60)}h ${Math.max(0, capacity.availableMinutes - capacity.occupiedMinutes) % 60}m</strong></div></div>`;
}

function renderUpcoming(appointments) {
  const now = new Date();
  const nowKey = toDateInputValue(now);
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const upcoming = appointments.filter((item) => item.status === "scheduled" && (item.date > nowKey || (item.date === nowKey && item.time >= nowTime))).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 5);
  const target = document.querySelector("#upcoming-list");
  if (!upcoming.length) {
    target.innerHTML = `<div class="mini-empty">Nenhum atendimento futuro neste período.</div>`;
    return;
  }
  target.innerHTML = upcoming.map((appointment) => `<div class="upcoming-row">
    <span class="upcoming-date">${escapeHtml(formatShortDate(appointment.date))}<strong>${escapeHtml(appointment.time)}</strong></span>
    <span class="upcoming-name"><strong>${escapeHtml(appointment.customerName)}</strong><small>${escapeHtml(serviceForAppointment(appointment)?.name || appointment.serviceName || "Serviço removido")}</small></span>
    <span class="upcoming-price">${currency(appointment.price)}</span>
  </div>`).join("");
}

function renderTeamPerformance(appointments) {
  const target = document.querySelector("#barber-performance");
  const activeStaff = state.staff.filter((member) => member.active);
  if (!activeStaff.length) {
    target.innerHTML = `<div class="mini-empty">Cadastre um profissional ativo em Equipe para acompanhar vendas e comissões.</div>`;
    return;
  }
  const previous = previousRange(currentDashboardRange);
  const ranked = activeStaff.map((member) => {
    const metrics = staffMetrics(member, currentDashboardRange);
    const prior = staffMetrics(member, { startKey: previous.startKey, endKey: previous.endKey });
    const growth = prior.revenue > 0 ? ((metrics.revenue - prior.revenue) / prior.revenue) * 100 : null;
    return { member, metrics, growth };
  }).sort((a, b) => b.metrics.revenue - a.metrics.revenue);
  target.innerHTML = `<div class="team-rows">${ranked.slice(0, 5).map(({ member, metrics, growth }, index) => `<div class="team-row">
    ${staffAvatarMarkup(member, "staff-avatar")}
    <span class="staff-copy"><strong>${index + 1}. ${escapeHtml(member.name)}</strong><small>${escapeHtml(member.role)} · ${metrics.count} atendimento(s) · ticket ${currency(metrics.ticket)}</small></span>
    <span class="team-metric">${currency(metrics.revenue)}<small>${currency(metrics.commission)} de comissão · ${growth === null ? "sem base" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1).replace(".", ",")}%`}</small></span>
  </div>`).join("")}</div>`;
}

function renderCustomers() {
  const customers = customerStats(state.appointments, currentDashboardRange);
  document.querySelector("#customer-segments").innerHTML = `<div class="customer-stat-line"><span>Novos no período</span><strong>${customers.newCount}</strong></div>
    <div class="customer-stat-line"><span>Clientes com visita no período</span><strong>${customers.activeCount}</strong></div>
    <div class="customer-stat-line"><span>Recorrentes no histórico</span><strong>${customers.repeatCount}</strong></div>
    <p class="empty-note">Identificação aproximada pelo nome digitado nos agendamentos.</p>`;
  const latest = new Map();
  completedAppointments(state.appointments).forEach((item) => {
    const key = customerKey(item);
    const current = latest.get(key);
    if (!current || item.date > current.date) latest.set(key, { name: item.customerName, date: item.date });
  });
  const lastVisits = [...latest.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  document.querySelector("#customer-retention").innerHTML = lastVisits.length
    ? lastVisits.map((customer) => `<div class="retention-row"><span><strong>${escapeHtml(customer.name)}</strong><small>Última visita: ${escapeHtml(formatShortDate(customer.date))}</small></span><span class="retention-date">${Math.max(0, Math.floor((new Date(`${toDateInputValue(new Date())}T00:00:00`) - parseDate(customer.date)) / 86_400_000))} dias</span></div>`).join("")
    : `<div class="mini-empty">O histórico de visitas aparecerá após os primeiros atendimentos concluídos.</div>`;
  document.querySelector("#crm-summary").innerHTML = `<div class="crm-metric"><span>Clientes VIP <small>3+ atendimentos concluídos</small></span><strong>${customers.vipCount}</strong></div>
    <div class="crm-metric"><span>Sem retorno há 30+ dias</span><strong>${customers.inactive30}</strong></div>
    <div class="crm-metric"><span>Sem retorno há 60+ dias</span><strong>${customers.inactive60}</strong></div>
    <div class="crm-metric"><span>Sem retorno há 90+ dias</span><strong>${customers.inactive90}</strong></div>
    <button class="button button-secondary button-small" data-action="new-appointment" type="button">Criar agendamento</button>
    <p class="empty-note">Campanhas e contatos promocionais ainda não estão habilitados.</p>`;
}

let currentDashboardRange;

function renderInsights(appointments, range) {
  const completed = completedAppointments(appointments);
  const bookings = appointments.filter((item) => item.status !== "cancelled");
  const dayCounts = new Map();
  const hourCounts = new Map();
  bookings.forEach((item) => {
    const day = DAY_LABELS[parseDate(item.date).getDay()];
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    hourCounts.set(item.time.slice(0, 2), (hourCounts.get(item.time.slice(0, 2)) || 0) + 1);
  });
  const busiestDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiestHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const services = new Map();
  completed.forEach((item) => {
    const name = serviceForAppointment(item)?.name || item.serviceName || "Serviço removido";
    services.set(name, (services.get(name) || 0) + 1);
  });
  const bestService = [...services.entries()].sort((a, b) => b[1] - a[1])[0];
  const futureCount = appointments.filter((item) => item.status === "scheduled").length;
  const insights = [
    { icon: "◷", title: `${futureCount} atendimento(s) confirmado(s) no período`, body: futureCount ? "Revise horários e confirme a disponibilidade da equipe." : "Sua agenda ainda não tem reservas futuras neste período.", tone: "accent" },
    { icon: "✂", title: bestService ? `${bestService[0]} lidera em serviços concluídos` : "Ainda sem serviço em destaque", body: bestService ? `${bestService[1]} atendimento(s) concluído(s) no período selecionado.` : "Conclua atendimentos para formar um ranking real.", tone: "neutral" },
    { icon: "◫", title: busiestDay ? `${busiestDay[0]} tem mais reservas` : "Sem padrão de demanda identificado", body: busiestDay ? `${busiestDay[1]} reserva(s) ativa(s); insight calculado pelos agendamentos.` : "Ainda não há reservas para comparar dias e horários.", tone: "neutral" }
  ];
  document.querySelector("#insights-list").innerHTML = insights.map((item) => `<div class="insight-row ${item.tone}"><span class="insight-icon">${item.icon}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)}</small></span></div>`).join("");
  const completedTotal = serviceValue(appointments);
  document.querySelector("#executive-summary").innerHTML = `<div class="executive-main"><span>Serviços concluídos</span><strong>${currency(completedTotal)}</strong><small>valor registrado · não é confirmação de pagamento</small></div>
    <div class="executive-grid"><div><span>Melhor serviço</span><strong>${bestService ? escapeHtml(bestService[0]) : "—"}</strong></div>
    <div><span>Dia mais movimentado</span><strong>${busiestDay ? escapeHtml(busiestDay[0]) : "—"}</strong></div>
    <div><span>Horário mais procurado</span><strong>${busiestHour ? `${escapeHtml(busiestHour[0])}:00` : "—"}</strong></div>
    <div><span>Melhor profissional</span><strong>—</strong></div>
    <div><span>Crescimento do mês</span><strong>—</strong></div>
    <div><span>Oportunidade de venda</span><strong>—</strong></div></div>`;
}

function formatActivityTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function activityIcon(type) {
  return { created: "＋", completed: "✓", cancelled: "×" }[type] || "·";
}

function renderActivityTimeline(targetId, limit = 8) {
  const target = document.querySelector(`#${targetId}`);
  const recent = state.activity.slice(-limit).reverse();
  if (!recent.length) {
    target.innerHTML = `<div class="mini-empty">As ações de agendamento aparecerão aqui conforme forem registradas.</div>`;
    return;
  }
  target.innerHTML = `<div class="activity-timeline">${recent.map((item) => `<div class="activity-entry">
    <span class="activity-marker ${escapeHtml(item.type)}">${activityIcon(item.type)}</span>
    <span class="activity-message"><strong>${escapeHtml(item.message)}</strong><small>${escapeHtml(formatActivityTime(item.createdAt))} · registrado neste navegador</small></span>
  </div>`).join("")}</div>`;
}

function nextAvailableSlot(dateValue, service = state.services[0]) {
  if (!service) return null;
  for (const staff of state.staff.filter((member) => member.active)) {
    const time = getAvailableSlots(dateValue, staff.id, service.duration)[0];
    if (time) return { time, service, staff };
  }
  return null;
}

function renderCopilot() {
  const now = new Date();
  const todayKey = toDateInputValue(now);
  const todayAppointments = activeAppointmentsFor(todayKey);
  const active = todayAppointments.filter((item) => item.status !== "cancelled");
  const future = active.filter((item) => item.status === "scheduled" && item.time >= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  const bookedValue = future.reduce((total, item) => total + item.price, 0);
  const capacity = capacityStats(todayAppointments, { start: parseDate(todayKey), end: parseDate(todayKey) });
  const freeSlot = nextAvailableSlot(todayKey);
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";
  document.querySelector("#copilot-heading").textContent = `${greeting}${state.professional.name ? `, ${state.professional.name.split(/\s+/)[0]}` : ""}. Vamos cuidar do seu negócio.`;
  document.querySelector("#copilot-summary").textContent = active.length
    ? `Hoje há ${active.length} atendimento(s) ativo(s) na agenda. Aqui está o que já sabemos:`
    : "Sua agenda ainda está tranquila hoje. Configure os próximos horários e acompanhe tudo por aqui.";
  const insightItems = [
    { label: "Agenda de hoje", value: String(active.length), detail: "atendimentos ativos", icon: "▦" },
    { label: "Ocupação prevista", value: capacity.percent === null ? "—" : `${capacity.percent}%`, detail: "reservas ÷ expediente", icon: "◴" },
    { label: "Valor agendado", value: currency(bookedValue), detail: "não representa pagamento", icon: "↗" },
    { label: "Próximo horário livre", value: freeSlot?.time || "—", detail: freeSlot ? `${freeSlot.service.name} · ${freeSlot.staff.name}` : "sem profissional ativo ou horário livre", icon: "⌁" }
  ];
  document.querySelector("#copilot-insights").innerHTML = insightItems.map((item) => `<div class="copilot-metric"><span class="copilot-metric-icon">${item.icon}</span><span class="copilot-metric-label">${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small></div>`).join("");
}

function clientRecords() {
  const records = new Map();
  completedAppointments(state.appointments).forEach((appointment) => {
    const key = customerKey(appointment);
    if (!key) return;
    const current = records.get(key) || { name: appointment.customerName.trim(), visits: 0, total: 0, lastVisit: appointment.date, phone: appointment.customerPhone || "" };
    current.visits += 1;
    current.total += appointment.price;
    if (appointment.date > current.lastVisit) current.lastVisit = appointment.date;
    if (!current.phone && appointment.customerPhone) current.phone = appointment.customerPhone;
    records.set(key, current);
  });
  return [...records.values()].sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
}

function renderClients() {
  const records = clientRecords();
  const recurring = records.filter((item) => item.visits > 1).length;
  const inactive = records.filter((item) => Math.floor((new Date(`${toDateInputValue(new Date())}T00:00:00`) - parseDate(item.lastVisit)) / 86_400_000) > 30).length;
  document.querySelector("#client-overview").innerHTML = [
    { label: "Clientes identificados", value: String(records.length), icon: "◎" },
    { label: "Clientes recorrentes", value: String(recurring), icon: "↻" },
    { label: "Sem retorno há 30+ dias", value: String(inactive), icon: "◷" }
  ].map((item) => `<article class="client-stat"><span>${item.icon}</span><small>${escapeHtml(item.label)}</small><strong>${item.value}</strong></article>`).join("");
  const body = document.querySelector("#clients-table-body");
  if (!records.length) {
    body.innerHTML = `<tr><td colspan="5"><div class="mini-empty">Ainda não há atendimentos concluídos. Os clientes aparecerão aqui após a conclusão de uma reserva.</div></td></tr>`;
    return;
  }
  body.innerHTML = records.map((record) => `<tr>
    <td><span class="client-name-cell"><i>${escapeHtml(initials(record.name, "C"))}</i><span><strong>${escapeHtml(record.name)}</strong><small>${record.phone ? escapeHtml(record.phone) : "Telefone não informado"}</small></span></span></td>
    <td>${record.visits}</td><td>${currency(record.total)}</td><td>${escapeHtml(formatShortDate(record.lastVisit))}</td>
    <td><span class="client-status ${record.visits > 1 ? "returning" : ""}">${record.visits > 1 ? "Recorrente" : "Primeira visita"}</span></td>
  </tr>`).join("");
}

function respondToAssistant(question) {
  const query = question.trim().toLocaleLowerCase("pt-BR");
  if (!query) return "Escreva uma pergunta para consultar os dados locais.";
  if (query.includes("servi") || query.includes("vend")) {
    const completed = completedAppointments(state.appointments);
    const ranking = new Map();
    completed.forEach((item) => {
      const name = serviceForAppointment(item)?.name || item.serviceName || "Serviço removido";
      ranking.set(name, (ranking.get(name) || 0) + 1);
    });
    const best = [...ranking.entries()].sort((a, b) => b[1] - a[1])[0];
    return best
      ? `${best[0]} tem mais atendimentos concluídos no histórico (${best[1]}). Este resultado considera apenas os registros locais.`
      : "Ainda não há atendimentos concluídos suficientes para comparar serviços.";
  }
  if (query.includes("agenda") || query.includes("hoje") || query.includes("horário") || query.includes("horario")) {
    const todayKey = toDateInputValue(new Date());
    const bookings = activeAppointmentsFor(todayKey).filter((item) => item.status === "scheduled");
    const slot = nextAvailableSlot(todayKey);
    return `Hoje há ${bookings.length} reserva(s) confirmada(s). ${slot ? `O próximo horário livre identificado para ${slot.service.name} é ${slot.time}.` : "Não encontrei um horário livre para o primeiro serviço cadastrado."}`;
  }
  if (query.includes("cliente") || query.includes("retorno") || query.includes("voltar")) {
    const records = clientRecords();
    if (!records.length) return "O histórico de clientes começa a aparecer depois que você conclui atendimentos. A identificação atual usa o nome informado na reserva.";
    const inactive = records.filter((item) => Math.floor((new Date(`${toDateInputValue(new Date())}T00:00:00`) - parseDate(item.lastVisit)) / 86_400_000) > 30);
    return inactive.length
      ? `${inactive.length} cliente(s) identificados estão sem atendimento concluído há mais de 30 dias. Confira a lista em Clientes antes de realizar qualquer contato.`
      : `Há ${records.length} cliente(s) identificados no histórico e nenhum está acima de 30 dias sem retorno, pelos dados disponíveis.`;
  }
  if (query.includes("fatur") || query.includes("receita") || query.includes("finance")) {
    const total = serviceValue(state.appointments);
    return `O valor registrado em serviços concluídos no histórico é ${currency(total)}. Isso não confirma recebimento nem representa lucro.`;
  }
  return "Posso consultar a agenda de hoje, o ranking de serviços concluídos, valores registrados ou clientes no histórico. Ainda não há uma IA generativa conectada.";
}

function openCommandPalette(query = "") {
  const dialog = document.querySelector("#command-dialog");
  const input = document.querySelector("#command-search");
  input.value = query;
  renderCommandResults(query);
  if (!dialog.open) dialog.showModal();
  input.focus();
}

function commandEntries(query = "") {
  const entries = [
    { title: "Abrir Dashboard", subtitle: "Visão geral do negócio", icon: "⌂", view: "overview" },
    { title: "Abrir Ecossistema", subtitle: "Plataformas e arquitetura EFAHub", icon: "◈", view: "ecosystem" },
    { title: "Abrir Agenda", subtitle: "Ver horários e atendimentos", icon: "▦", view: "agenda" },
    { title: "Abrir Clientes", subtitle: "Consultar histórico de visitas", icon: "◎", view: "clients" },
    { title: "Abrir Equipe", subtitle: "Profissionais, desempenho e comissões", icon: "♙", view: "team" },
    { title: "Abrir Serviços", subtitle: "Gerenciar preços e duração", icon: "✂", view: "services" },
    { title: "Abrir Produtos", subtitle: "Catálogo e controle de estoque", icon: "▤", view: "products" },
    { title: "Abrir Lista de espera", subtitle: "Clientes aguardando encaixe", icon: "◷", view: "waitlist" },
    { title: "Abrir Financeiro", subtitle: "Vendas manuais e valores pendentes", icon: "R$", view: "finance" },
    { title: "Abrir Página pública", subtitle: "Prévia local do perfil", icon: "↗", view: "public-page" },
    { title: "Abrir Suporte", subtitle: "Solicitações e links locais", icon: "?", view: "support" },
    { title: "Abrir EFA AI", subtitle: "Consultar dados locais", icon: "✳", view: "intelligence" },
    { title: "Abrir Configurações", subtitle: "Marca, horários e equipe", icon: "⚙", view: "settings" },
    { title: "Criar agendamento", subtitle: "Reservar um horário manualmente", icon: "＋", action: "new-appointment" },
    { title: "Adicionar serviço", subtitle: "Cadastrar serviço e preço", icon: "＋", action: "new-service" }
  ];
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const clients = clientRecords().filter((client) => !normalized || client.name.toLocaleLowerCase("pt-BR").includes(normalized))
    .map((client) => ({ title: client.name, subtitle: `Cliente · ${client.visits} visita(s)`, icon: initials(client.name, "C"), view: "clients" }));
  return [...entries.filter((entry) => !normalized || `${entry.title} ${entry.subtitle}`.toLocaleLowerCase("pt-BR").includes(normalized)), ...clients].slice(0, 9);
}

function renderCommandResults(query = "") {
  const entries = commandEntries(query);
  const target = document.querySelector("#command-results");
  commandActiveIndex = 0;
  target.innerHTML = entries.length ? entries.map((entry, index) => `<button class="command-result ${index === 0 ? "active" : ""}" data-command-index="${index}" type="button"><span class="command-result-icon">${entry.icon}</span><span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.subtitle)}</small></span><kbd>↵</kbd></button>`).join("") : `<div class="command-empty">Nenhum resultado para esta busca.</div>`;
}

function runCommand(index) {
  const entry = commandEntries(document.querySelector("#command-search").value)[index];
  if (!entry) return;
  document.querySelector("#command-dialog").close();
  if (entry.view) return navigate(entry.view);
  if (entry.action === "new-appointment") openAppointmentDialog();
  if (entry.action === "new-service") openServiceDialog();
}

function renderOverview() {
  const now = new Date();
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" }).format(now);
  document.querySelector("#greeting").textContent = "GESTÃO INTELIGENTE PARA NEGÓCIOS DE BELEZA";
  document.querySelector("#dashboard-shop-name").textContent = state.shopName;
  document.querySelector("#dashboard-greeting").textContent = `${now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite"}${state.professional.name ? `, ${state.professional.name.split(/\s+/)[0]}` : ""}`;
  currentDashboardRange = getDashboardRange(
    dashboardPeriod,
    document.querySelector("#period-start").value,
    document.querySelector("#period-end").value
  );
  document.querySelectorAll("[data-period], [data-team-period]").forEach((button) => {
    button.classList.toggle("active", (button.dataset.period || button.dataset.teamPeriod) === dashboardPeriod);
  });
  document.querySelector("#custom-period").classList.toggle("hidden", dashboardPeriod !== "custom");
  document.querySelector("#team-custom-period").classList.toggle("hidden", dashboardPeriod !== "custom");
  document.querySelector("#period-label").textContent = currentDashboardRange.label;
  document.querySelector("#shop-name-sidebar").textContent = state.shopName;
  const todayAppointments = activeAppointmentsFor(toDateInputValue(now));
  document.querySelector("#nav-count").textContent = String(todayAppointments.filter((item) => item.status === "scheduled").length);
  const appointments = appointmentsInRange(currentDashboardRange);
  const previousAppointments = appointmentsInRange(previousRange(currentDashboardRange));
  renderKpis(appointments, previousAppointments, currentDashboardRange);
  renderRevenueChart(appointments, currentDashboardRange);
  renderBreakdown(appointments);
  renderServiceRanking(appointments);
  renderCapacity(appointments, currentDashboardRange);
  renderUpcoming(appointments);
  renderTeamPerformance(appointments);
  renderCustomers();
  renderInsights(appointments, currentDashboardRange);
  renderCopilot();
  renderActivityTimeline("activity-timeline", 5);
  renderActivityTimeline("intelligence-timeline", 10);
  renderClients();
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportDashboardReport() {
  const range = getDashboardRange(
    dashboardPeriod,
    document.querySelector("#period-start").value,
    document.querySelector("#period-end").value
  );
  const appointments = appointmentsInRange(range);
  if (!appointments.length) {
    showToast("Não há agendamentos neste período para exportar.");
    return;
  }
  const columns = ["Data", "Horário", "Cliente", "Serviço", "Duração (min)", "Status", "Valor do serviço (R$)"];
  const rows = appointments.map((item) => [
    item.date,
    item.time,
    item.customerName,
    serviceForAppointment(item)?.name || item.serviceName || "Serviço removido",
    item.duration,
    statusLabel(item.status),
    item.price.toFixed(2).replace(".", ",")
  ]);
  const csv = `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `efahub-relatorio-${range.startKey}-${range.endKey}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${appointments.length} agendamento(s) exportado(s) em CSV.`);
}

function renderAgenda() {
  const dateValue = state.selectedDate;
  const appointments = activeAppointmentsFor(dateValue);
  const dayKey = DAY_KEYS[parseDate(dateValue).getDay()];
  const hours = state.businessHours[dayKey];
  const dayLabel = document.querySelector("#agenda-day-label");
  dayLabel.textContent = formatLongDate(dateValue);
  document.querySelector("#agenda-summary").textContent = `${appointments.filter((item) => item.status !== "cancelled").length} atendimento(s)`;

  const timeline = document.querySelector("#agenda-timeline");
  if (!appointments.length) {
    timeline.innerHTML = hours.open
      ? `<div class="day-empty"><strong>Nenhum atendimento para este dia</strong>Use “Novo agendamento” para reservar um horário.</div>`
      : `<div class="day-empty"><strong>Negócio fechado</strong>Este dia está configurado como folga em Configurações.</div>`;
    return;
  }

  const hourRows = [];
  const appointmentHours = appointments.map((appointment) => Number(appointment.time.slice(0, 2)));
  const firstHour = hours.open ? Number(hours.start.slice(0, 2)) : Math.min(...appointmentHours);
  const lastHour = hours.open ? Math.ceil(timeToMinutes(hours.end) / 60) : Math.max(...appointmentHours) + 1;
  for (let hour = firstHour; hour < lastHour; hour += 1) {
    const hourLabel = `${String(hour).padStart(2, "0")}:00`;
    const hourAppointments = appointments.filter((appointment) => Number(appointment.time.slice(0, 2)) === hour);
    const appointmentMarkup = hourAppointments.map((appointment) => {
      const service = serviceForAppointment(appointment);
      const serviceName = appointment.serviceName || service?.name || "Serviço removido";
      const professionalName = appointment.staffName || state.staff.find((member) => member.id === appointment.staffId)?.name || "Profissional";
      const phoneMarkup = appointment.customerPhone
        ? `<button class="compact-action whatsapp-action" data-action="whatsapp" data-id="${escapeHtml(appointment.id)}" type="button">WhatsApp</button>`
        : "";
      const appointmentDateTime = parseDate(appointment.date);
      appointmentDateTime.setHours(...appointment.time.split(":").map(Number), 0, 0);
      const canComplete = appointmentDateTime <= new Date();
      const statusMarkup = appointment.status === "scheduled"
        ? `<button class="compact-action" data-action="edit-appointment" data-id="${escapeHtml(appointment.id)}" type="button">Alterar</button><button class="compact-action" data-action="complete" data-id="${escapeHtml(appointment.id)}" type="button" ${canComplete ? "" : 'disabled title="Disponível após o horário agendado"'}>Concluir</button><button class="compact-action cancel-action" data-action="cancel" data-id="${escapeHtml(appointment.id)}" type="button">Cancelar</button>`
        : `<span class="status-pill ${appointment.status}">${statusLabel(appointment.status)}</span>`;
      return `<article class="timeline-appointment ${appointment.status}">
        <div class="timeline-copy"><strong>${escapeHtml(appointment.customerName)} <span class="optional">· ${escapeHtml(appointment.time)}</span></strong>
        <span>${escapeHtml(serviceName)} · ${currency(appointment.price)} · ${formatDuration(appointment.duration)}${appointment.staffId ? ` · ${escapeHtml(professionalName)}` : ""}${appointment.notes ? ` · ${escapeHtml(appointment.notes)}` : ""}</span></div>
        <div class="timeline-actions">${phoneMarkup}${statusMarkup}</div>
      </article>`;
    }).join("");
    hourRows.push(`<div class="time-slot"><span class="time-slot-label">${hourLabel}</span><div class="slot-content">${appointmentMarkup || '<div class="slot-empty"></div>'}</div></div>`);
  }
  timeline.innerHTML = hourRows.join("");
}

function renderServices() {
  const list = document.querySelector("#services-list");
  if (!state.services.length) {
    list.innerHTML = `<div class="empty-state service-empty"><strong>Nenhum serviço cadastrado</strong>Adicione um serviço antes de criar agendamentos.</div>`;
    return;
  }
  list.innerHTML = state.services.map((service) => `<article class="service-card">
    <div class="service-card-top"><h2>${escapeHtml(service.name)}</h2><span class="service-status ${service.active ? "" : "inactive"}">${service.active ? "ATIVO" : "INATIVO"}</span></div>
    <p>${escapeHtml(service.description || "Descrição não informada.")}</p>
    <div class="service-meta"><span>${currency(service.price)}</span><span>${formatDuration(service.duration)}</span></div>
    <small class="service-assignees">${service.staffIds.length ? `${service.staffIds.length} profissional(is) vinculado(s)` : "Disponível para todos os profissionais ativos"}</small>
    <div class="service-actions"><button data-action="edit-service" data-id="${escapeHtml(service.id)}" type="button">Editar</button><button class="delete-service" data-action="delete-service" data-id="${escapeHtml(service.id)}" type="button">Remover</button></div>
  </article>`).join("");
}

function renderProducts() {
  const list = document.querySelector("#products-list");
  const select = document.querySelector("#sale-product");
  const waitlistSelect = document.querySelector("#waitlist-service");
  const stockCount = state.products.reduce((total, product) => total + product.stock, 0);
  document.querySelector("#products-summary").textContent = `${state.products.length} produto(s) · ${stockCount} unidade(s) em estoque`;
  const availableProducts = state.products.filter((product) => product.stock > 0);
  select.innerHTML = availableProducts.length
    ? availableProducts.map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} · ${product.stock} un. · ${currency(product.price)}</option>`).join("")
    : '<option value="">Nenhum produto com estoque disponível</option>';
  select.disabled = availableProducts.length === 0;
  const activeServices = state.services.filter((service) => service.active);
  if (waitlistSelect) waitlistSelect.innerHTML = activeServices.length
    ? activeServices.map((service) => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)}</option>`).join("")
    : '<option value="">Cadastre um serviço primeiro</option>';
  if (waitlistSelect) waitlistSelect.disabled = activeServices.length === 0;
  document.querySelector("#product-sale-form button[type=submit]").disabled = select.disabled;
  list.innerHTML = state.products.length ? state.products.map((product) => `
    <article class="dashboard-card product-card ${product.stock <= product.minStock ? "product-low-stock" : ""}">
      <div class="card-heading"><div><h3>${escapeHtml(product.name)}</h3><p>${product.sku ? `SKU ${escapeHtml(product.sku)}` : "Sem SKU"}</p></div><span class="product-stock-pill">${product.stock <= product.minStock ? "ESTOQUE BAIXO" : "EM ESTOQUE"}</span></div>
      <div class="product-meta"><span><small>Preço</small><strong>${currency(product.price)}</strong></span><span><small>Quantidade</small><strong>${product.stock}</strong></span><span><small>Custo</small><strong>${product.cost === null ? "—" : currency(product.cost)}</strong></span></div>
      <div class="product-stock-actions"><label class="sr-only" for="stock-quantity-${escapeHtml(product.id)}">Quantidade para movimentação</label><input class="text-input" id="stock-quantity-${escapeHtml(product.id)}" data-stock-quantity="${escapeHtml(product.id)}" type="number" min="1" step="1" value="1"><button class="button button-secondary button-small" data-action="stock-in" data-id="${escapeHtml(product.id)}" type="button">Entrada</button><button class="button button-secondary button-small" data-action="stock-out" data-id="${escapeHtml(product.id)}" type="button">Saída</button></div>
      <div class="service-actions"><button data-action="edit-product" data-id="${escapeHtml(product.id)}" type="button">Editar</button><button class="delete-service" data-action="delete-product" data-id="${escapeHtml(product.id)}" type="button">Remover</button></div>
    </article>`).join("") : '<div class="empty-state"><strong>Nenhum produto cadastrado</strong>Cadastre o catálogo e a quantidade disponível para começar.</div>';
  updateSaleTotal();
}

function updateSaleTotal() {
  const product = state.products.find((item) => item.id === document.querySelector("#sale-product").value);
  const quantity = Number(document.querySelector("#sale-quantity").value);
  document.querySelector("#sale-total-preview").textContent = currency(product && Number.isInteger(quantity) && quantity > 0 ? product.price * quantity : 0);
}

function paymentMethodLabel(method) {
  return { cash: "Dinheiro", pix: "PIX · manual", card: "Cartão · manual", receivable: "A receber" }[method] || "Outro";
}

function renderFinance() {
  const received = state.sales.filter((sale) => sale.paymentStatus === "received").reduce((total, sale) => total + sale.total, 0);
  const pending = state.sales.filter((sale) => sale.paymentStatus === "pending").reduce((total, sale) => total + sale.total, 0);
  const refunded = state.sales.filter((sale) => sale.paymentStatus === "refunded").reduce((total, sale) => total + sale.total, 0);
  const cards = [
    ["Vendas registradas", currency(state.sales.filter((sale) => sale.paymentStatus !== "refunded").reduce((total, sale) => total + sale.total, 0)), `${state.sales.length} lançamento(s) locais`],
    ["Lançamentos recebidos", currency(received), "Registro manual, sem conciliação bancária"],
    ["A receber", currency(pending), "Vendas lançadas como pendentes"],
    ["Estornos locais", currency(refunded), "Não representa transferência efetiva"]
  ];
  document.querySelector("#finance-summary").innerHTML = cards.map(([label, amount, caption]) => `<article class="dashboard-card finance-summary-card"><span>${label}</span><strong>${amount}</strong><small>${caption}</small></article>`).join("");
  const salesList = document.querySelector("#sales-list");
  salesList.innerHTML = state.sales.length ? state.sales.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((sale) => {
    const product = state.products.find((item) => item.id === sale.productId);
    const status = sale.paymentStatus === "received" ? "Recebido · manual" : sale.paymentStatus === "pending" ? "Pendente" : "Estornado localmente";
    return `<div class="sale-row"><span><strong>${escapeHtml(product?.name || "Produto removido")} × ${sale.quantity}</strong><small>${escapeHtml(formatShortDate(sale.createdAt.slice(0, 10)))} · ${paymentMethodLabel(sale.paymentMethod)} · ${status}</small></span><strong>${currency(sale.total)}</strong>${sale.paymentStatus !== "refunded" ? `<button class="text-button" data-action="refund-sale" data-id="${escapeHtml(sale.id)}" type="button">Estornar e devolver estoque</button>` : ""}</div>`;
  }).join("") : '<div class="empty-state"><strong>Nenhuma venda registrada</strong>As vendas de produtos aparecerão aqui após o lançamento manual.</div>';
}

function renderWaitlist() {
  const target = document.querySelector("#waitlist-list");
  const entries = state.waitlist.slice().sort((a, b) => a.preferredDate.localeCompare(b.preferredDate) || a.createdAt.localeCompare(b.createdAt));
  target.innerHTML = entries.length ? entries.map((entry) => {
    const service = state.services.find((item) => item.id === entry.serviceId);
    const professional = entry.staffId ? state.staff.find((item) => item.id === entry.staffId)?.name : "";
    const serviceUnavailable = !service?.active;
    const status = entry.status === "booked" ? "Agendado" : serviceUnavailable ? "Serviço inativo" : "Aguardando";
    return `<div class="waitlist-row"><span class="waitlist-date">${escapeHtml(formatShortDate(entry.preferredDate))}</span><span class="waitlist-copy"><strong>${escapeHtml(entry.customerName)}</strong><small>${escapeHtml(service?.name || "Serviço removido")}${professional ? ` · ${escapeHtml(professional)}` : ""}${entry.customerPhone ? ` · ${escapeHtml(entry.customerPhone)}` : ""}</small></span><span class="status-pill ${entry.status === "booked" ? "completed" : ""}">${status}</span>${entry.status === "waiting" ? `${serviceUnavailable ? "" : `<button class="button button-secondary button-small" data-action="book-waitlist" data-id="${escapeHtml(entry.id)}" type="button">Agendar</button>`}<button class="text-button" data-action="remove-waitlist" data-id="${escapeHtml(entry.id)}" type="button">Remover</button>` : ""}</div>`;
  }).join("") : '<div class="empty-state"><strong>Lista vazia</strong>Adicione clientes que solicitaram voluntariamente um encaixe.</div>';
}

function categoryLabel(category) {
  return {
    beauty: "Salão de beleza", barbershop: "Barbearia", aesthetics: "Clínica de estética",
    brows: "Design de sobrancelhas / cílios", nails: "Manicure / pedicure",
    health: "Profissional da saúde", fitness: "Personal trainer", education: "Professor particular",
    other: "Negócio com hora marcada"
  }[category] || "Negócio com hora marcada";
}

function renderPublicPage() {
  const services = state.services.filter((service) => service.active).map((service) => `<div class="public-service-row"><span><strong>${escapeHtml(service.name)}</strong><small>${escapeHtml(service.description)} · ${formatDuration(service.duration)}</small></span><strong>${currency(service.price)}</strong></div>`).join("") || '<p class="empty-note">Nenhum serviço ativo publicado.</p>';
  const staff = state.staff.filter((member) => member.active).map((member) => `<span class="public-staff-chip">${escapeHtml(member.name)} · ${escapeHtml(member.role)}</span>`).join("") || '<span class="empty-note">Nenhum profissional ativo cadastrado.</span>';
  document.querySelector("#public-page-preview").innerHTML = `
    <article class="public-preview-card">
      <div class="public-cover">${state.shopLogo ? `<img src="${state.shopLogo}" alt="">` : `<span>${escapeHtml(initials(state.shopName, "E"))}</span>`}<span class="public-preview-badge">${state.onlineBookingEnabled ? "AGENDAMENTO ATIVADO NA PRÉVIA" : "AGENDAMENTO ONLINE DESATIVADO"}</span></div>
      <div class="public-profile-content"><p class="section-kicker">${escapeHtml(categoryLabel(state.businessCategory))}</p><h2>${escapeHtml(state.shopName)}</h2><p>${escapeHtml(state.shopContact.address || "Endereço não informado")}</p>${state.shopContact.phone ? `<p>${escapeHtml(state.shopContact.phone)}</p>` : ""}
        <div class="public-service-list">${services}</div><div class="public-staff-list">${staff}</div>
        <button class="button button-primary" id="public-booking-button" data-action="public-booking" type="button" ${state.onlineBookingEnabled ? "" : "disabled"}>${state.onlineBookingEnabled ? "Simular agendamento (demonstração)" : "Agendamento online indisponível"}</button>
        <p class="field-help">Identificador local: <strong>${escapeHtml(state.publicSlug)}</strong> · Esta prévia não possui URL pública.</p>
      </div>
    </article>`;
}

function renderSupport() {
  const links = [
    ["Instagram", state.shopContact.instagram],
    ["Suporte", state.shopContact.supportUrl],
    ["Termos de Uso", state.shopContact.termsUrl],
    ["Política de Privacidade", state.shopContact.privacyUrl]
  ].filter(([, url]) => url);
  document.querySelector("#support-links").innerHTML = links.length
    ? links.map(([label, url]) => `<a class="support-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`).join("")
    : '<p class="empty-note">Nenhum canal foi configurado. Adicione os links oficiais em Configurações.</p>';
  const tickets = state.supportTickets.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.querySelector("#support-tickets").innerHTML = tickets.length ? tickets.map((ticket) => `<div class="support-ticket-row"><span><strong>${escapeHtml(ticket.categoryLabel)}</strong><small>${escapeHtml(new Date(ticket.createdAt).toLocaleString("pt-BR"))} · Registrado apenas neste navegador</small><p>${escapeHtml(ticket.message)}</p></span><span class="status-pill">Local</span></div>`).join("") : '<div class="empty-state"><strong>Nenhuma solicitação</strong>As solicitações criadas neste navegador serão listadas aqui.</div>';
}

function renderServiceOptions(selectedId) {
  const select = document.querySelector("#service-select");
  const activeServices = state.services.filter((service) => service.active);
  select.innerHTML = activeServices.length ? activeServices.map((service) =>
    `<option value="${escapeHtml(service.id)}" ${service.id === selectedId ? "selected" : ""}>${escapeHtml(service.name)} — ${currency(service.price)} / ${formatDuration(service.duration)}</option>`
  ).join("") : '<option value="">Cadastre um serviço ativo em Serviços</option>';
  select.disabled = activeServices.length === 0;
  renderAppointmentStaffOptions();
}

function renderAppointmentStaffOptions(selectedId = "") {
  const select = document.querySelector("#appointment-staff");
  const service = state.services.find((item) => item.id === document.querySelector("#service-select").value && item.active);
  const activeStaff = state.staff.filter((member) => member.active && (!service?.staffIds.length || service.staffIds.includes(member.id)));
  const emptyLabel = !state.staff.some((member) => member.active)
    ? "Cadastre um profissional ativo em Equipe"
    : activeStaff.length ? "Selecione um profissional" : "Nenhum profissional habilitado para este serviço";
  select.innerHTML = `<option value="">${emptyLabel}</option>${activeStaff.map((member) => `<option value="${escapeHtml(member.id)}" ${member.id === selectedId ? "selected" : ""}>${escapeHtml(member.name)} — ${escapeHtml(member.role)}</option>`).join("")}`;
  select.disabled = activeStaff.length === 0;
  refreshAvailableSlots();
}

function render() {
  document.querySelector("#shop-name-sidebar").textContent = state.shopName;
  document.querySelector("#breadcrumb-current").textContent = document.querySelector(".nav-item.active .nav-label-text")?.textContent.trim() || "Dashboard";
  elements.agendaDate.value = state.selectedDate;
  renderSettings();
  renderOverview();
  renderAgenda();
  renderServices();
  renderServiceOptions(document.querySelector("#service-select").value);
  renderTeam();
  renderProducts();
  renderWaitlist();
  renderFinance();
  renderPublicPage();
  renderSupport();
}

function initials(name, fallback) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function renderLogo() {
  const preview = document.querySelector("#logo-preview-image");
  const sidebarLogo = document.querySelector("#shop-logo-sidebar");
  const placeholder = document.querySelector("#logo-placeholder");
  const initial = document.querySelector("#shop-initial");
  preview.hidden = !state.shopLogo;
  sidebarLogo.hidden = !state.shopLogo;
  placeholder.hidden = Boolean(state.shopLogo);
  initial.hidden = Boolean(state.shopLogo);
  if (state.shopLogo) {
    preview.src = state.shopLogo;
    sidebarLogo.src = state.shopLogo;
  } else {
    preview.removeAttribute("src");
    sidebarLogo.removeAttribute("src");
  }
  initial.textContent = initials(state.shopName, "B").slice(0, 1);
}

function renderBusinessHours() {
  document.querySelector("#business-hours-list").innerHTML = DAY_KEYS.map((day, index) => {
    const hours = state.businessHours[day];
    return `<div class="business-hours-row">
      <label class="day-toggle"><input type="checkbox" data-day-open="${day}" ${hours.open ? "checked" : ""}><span>${DAY_LABELS[index]}</span></label>
      <div class="hours-inputs">
        <input class="text-input" type="time" aria-label="Abertura ${DAY_LABELS[index]}" data-day-start="${day}" value="${hours.start}" ${hours.open ? "" : "disabled"}>
        <span>até</span>
        <input class="text-input" type="time" aria-label="Fechamento ${DAY_LABELS[index]}" data-day-end="${day}" value="${hours.end}" ${hours.open ? "" : "disabled"}>
      </div>
    </div>`;
  }).join("");
}

function staffAvatarMarkup(member, className = "staff-avatar") {
  return `<span class="${className}">${member.photo ? `<img src="${member.photo}" alt="">` : escapeHtml(initials(member.name, "P"))}</span>`;
}

function staffCommissionAmount(appointment) {
  return appointment.status === "completed" && Number.isFinite(appointment.commissionAmount)
    ? appointment.commissionAmount
    : 0;
}

function staffCommissionLabel(member) {
  const type = member.commissionType || "percentage";
  const value = member.commissionValue ?? member.commissionRate ?? 0;
  return type === "fixed" ? `${currency(value)} fixa` : `${value}%`;
}

function staffMetrics(member, range) {
  const completed = state.appointments.filter((item) => item.staffId === member.id && item.status === "completed"
    && item.date >= range.startKey && item.date <= range.endKey);
  const bookings = state.appointments.filter((item) => item.staffId === member.id && item.status !== "cancelled"
    && item.date >= range.startKey && item.date <= range.endKey);
  const revenue = completed.reduce((total, item) => total + item.price, 0);
  const commission = completed.reduce((total, item) => total + staffCommissionAmount(item), 0);
  const appointmentIds = new Set(completed.map((item) => item.id));
  const paid = state.commissionPayments.reduce((total, payment) => total + (payment.staffId === member.id
    ? payment.lines.reduce((sum, line) => sum + (appointmentIds.has(line.appointmentId) ? line.amount : 0), 0)
    : 0), 0);
  const availableMinutes = staffAvailableMinutes(member, range.startKey, range.endKey);
  const occupiedMinutes = bookings.reduce((total, item) => total + item.duration, 0);
  return {
    count: completed.length,
    revenue,
    ticket: completed.length ? revenue / completed.length : 0,
    commission,
    paid,
    pending: Math.max(0, commission - paid),
    availableMinutes,
    occupiedMinutes,
    occupancy: availableMinutes ? Math.min(100, Math.round(occupiedMinutes / availableMinutes * 100)) : null,
    completed
  };
}

function intervalOverlapTotal(intervals, start, end) {
  const clipped = intervals.map((item) => ({ start: Math.max(start, item.start), end: Math.min(end, item.end) }))
    .filter((item) => item.start < item.end)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let cursor = start;
  for (const interval of clipped) {
    if (interval.start > cursor) cursor = interval.start;
    if (interval.end > cursor) {
      total += interval.end - cursor;
      cursor = interval.end;
    }
  }
  return total;
}

function staffAvailableMinutes(member, startKey, endKey) {
  if (!member.active) return 0;
  let total = 0;
  for (let date = parseDate(startKey); date <= parseDate(endKey); date = shiftDate(date, 1)) {
    const schedule = staffScheduleFor(member, date);
    if (!schedule) continue;
    total += schedule.end - schedule.start - intervalOverlapTotal(schedule.pauses, schedule.start, schedule.end);
  }
  return Math.max(0, total);
}

function renderStaff() {
  const list = document.querySelector("#staff-directory");
  if (!state.staff.length) {
    list.innerHTML = `<div class="dashboard-card mini-empty">Nenhum profissional cadastrado. Adicione uma pessoa da equipe para habilitar agendamentos.</div>`;
    return;
  }
  const range = currentDashboardRange || getDashboardRange("month");
  list.innerHTML = state.staff.map((member) => {
    const metrics = staffMetrics(member, range);
    const history = state.appointments.filter((item) => item.staffId === member.id && item.status === "completed")
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
    const services = new Map();
    history.forEach((item) => services.set(item.serviceName || serviceForAppointment(item)?.name || "Serviço", (services.get(item.serviceName || serviceForAppointment(item)?.name || "Serviço") || 0) + 1));
    const servicesMarkup = [...services.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${escapeHtml(name)} (${count})`).join(", ");
    const historyMarkup = history.length ? history.map((item) => `<div class="staff-history-row"><span><strong>${escapeHtml(formatShortDate(item.date))} · ${escapeHtml(item.time)}</strong><small>${escapeHtml(item.customerName)} · ${escapeHtml(item.serviceName || serviceForAppointment(item)?.name || "Serviço")}</small></span><span>${currency(item.price)}<small>${currency(staffCommissionAmount(item))} comissão</small></span></div>`).join("") : `<div class="mini-empty">Nenhum atendimento concluído associado a este profissional.</div>`;
    return `<article class="dashboard-card staff-profile-card">
      <div class="staff-profile-head">${staffAvatarMarkup(member, "staff-profile-avatar")}<div class="staff-profile-name"><h3>${escapeHtml(member.name)}</h3><span>${escapeHtml(member.role)} · <span class="staff-status ${member.active ? "active" : "inactive"}">${member.active ? "Ativo" : "Inativo"}</span></span></div></div>
      <div class="staff-profile-contact"><span>${escapeHtml(member.phone || "Telefone não informado")}</span><span>${escapeHtml(member.email || "E-mail não informado")}</span><span>Entrada: ${member.joinedAt ? escapeHtml(formatShortDate(member.joinedAt)) : "não informada"}</span></div>
      <div class="staff-profile-metrics"><div><small>Concluídos no período</small><strong>${metrics.count}</strong></div><div><small>Receita realizada</small><strong>${currency(metrics.revenue)}</strong></div><div><small>Comissão acumulada</small><strong>${currency(metrics.commission)}</strong></div></div>
      <div class="staff-profile-metrics secondary"><div><small>Ticket médio</small><strong>${currency(metrics.ticket)}</strong></div><div><small>Comissão</small><strong>${escapeHtml(staffCommissionLabel(member))}</strong></div><div><small>Avaliação média</small><strong>Sem avaliações</strong></div></div>
      <p class="staff-services"><strong>Serviços realizados:</strong> ${servicesMarkup || "Ainda não há serviços concluídos."}</p>
      <div class="staff-actions"><button class="button button-secondary button-small" data-action="edit-staff" data-id="${escapeHtml(member.id)}" type="button">Editar</button><button class="button button-secondary button-small" data-action="toggle-staff" data-id="${escapeHtml(member.id)}" type="button">${member.active ? "Desativar" : "Ativar"}</button></div>
      <details class="staff-history"><summary>Histórico de atendimentos (${history.length})</summary><div>${historyMarkup}</div></details>
    </article>`;
  }).join("");
}

function renderTeam() {
  const range = getDashboardRange(
    dashboardPeriod,
    document.querySelector("#team-period-start").value,
    document.querySelector("#team-period-end").value
  );
  const staff = state.staff;
  const metrics = staff.map((member) => ({ member, ...staffMetrics(member, range) }));
  const totals = metrics.reduce((sum, item) => ({
    revenue: sum.revenue + item.revenue,
    count: sum.count + item.count,
    commission: sum.commission + item.commission,
    paid: sum.paid + item.paid,
    pending: sum.pending + item.pending
  }), { revenue: 0, count: 0, commission: 0, paid: 0, pending: 0 });
  document.querySelector("#team-overview").innerHTML = [
    { label: "Receita concluída", value: currency(totals.revenue), icon: "↗" },
    { label: "Atendimentos concluídos", value: String(totals.count), icon: "✓" },
    { label: "Comissões geradas", value: currency(totals.commission), icon: "%" },
    { label: "Comissão paga", value: currency(totals.paid), icon: "✓" },
    { label: "Comissão pendente", value: currency(totals.pending), icon: "◷" }
  ].map((item) => `<article class="client-stat team-stat"><span aria-hidden="true">${item.icon}</span><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></article>`).join("");

  const previous = previousRange(range);
  const ranked = metrics.map((item) => {
    const prior = staffMetrics(item.member, { startKey: previous.startKey, endKey: previous.endKey });
    const growth = prior.revenue > 0 ? ((item.revenue - prior.revenue) / prior.revenue) * 100 : null;
    return { ...item, growth };
  });
  const sortValue = {
    revenue: (item) => item.revenue,
    count: (item) => item.count,
    ticket: (item) => item.ticket,
    commission: (item) => item.commission,
    occupancy: (item) => item.occupancy ?? -1,
    growth: (item) => item.growth ?? Number.NEGATIVE_INFINITY
  }[teamSort] || ((item) => item.revenue);
  ranked.sort((a, b) => sortValue(b) - sortValue(a) || a.member.name.localeCompare(b.member.name, "pt-BR"));
  document.querySelector("#team-performance-list").innerHTML = ranked.length
    ? ranked.map(({ member, count, revenue, ticket, commission, paid, pending, occupancy, growth }, index) => `<article class="dashboard-card team-performance-card">
      <div class="team-performance-main">${staffAvatarMarkup(member, "staff-profile-avatar")}<div><span class="section-kicker">RANKING ${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(member.name)}</h3><small>${escapeHtml(member.role)} · ${member.active ? "Ativo" : "Inativo"}</small></div><strong class="team-performance-revenue">${currency(revenue)}</strong></div>
      <div class="team-performance-metrics"><div><small>Atendimentos</small><strong>${count}</strong></div><div><small>Ticket médio</small><strong>${currency(ticket)}</strong></div><div><small>Comissão gerada</small><strong>${currency(commission)}</strong></div><div><small>Pago / pendente</small><strong>${currency(paid)} / ${currency(pending)}</strong></div><div><small>Ocupação</small><strong>${occupancy === null ? "—" : `${occupancy}%`}</strong></div><div><small>Crescimento</small><strong>${growth === null ? "Sem base" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1).replace(".", ",")}%`}</strong></div></div>
    </article>`).join("")
    : `<div class="dashboard-card mini-empty">Cadastre profissionais para começar o acompanhamento da equipe.</div>`;

  document.querySelector("#commission-close-list").innerHTML = metrics.length
    ? metrics.map(({ member, revenue, commission, paid, pending, count }) => `<article class="dashboard-card commission-close-card">
      <div><h3>${escapeHtml(member.name)}</h3><small>${count} serviço(s) concluído(s) · comissão ${escapeHtml(staffCommissionLabel(member))}</small></div>
      <div class="commission-close-values"><div><small>Total vendido</small><strong>${currency(revenue)}</strong></div><div><small>Comissão</small><strong>${currency(commission)}</strong></div><div><small>Pago</small><strong>${currency(paid)}</strong></div><div><small>Pendente</small><strong>${currency(pending)}</strong></div></div>
      <button class="button button-primary button-small" data-action="pay-commission" data-id="${escapeHtml(member.id)}" type="button" ${pending <= 0 ? "disabled" : ""}>${pending > 0 ? "Registrar pagamento" : "Sem pendências"}</button>
    </article>`).join("")
    : `<div class="dashboard-card mini-empty">Cadastre profissionais para gerar o fechamento de comissões.</div>`;
  renderStaff();
  renderTeamInsights(ranked, totals, range);
  renderCommissionPaymentHistory();
}

function renderTeamInsights(ranked, totals, range) {
  const best = ranked.reduce((leader, item) => item.revenue > 0 && (!leader || item.revenue > leader.revenue) ? item : leader, null);
  const highOccupancy = ranked.reduce((leader, item) => item.occupancy !== null && item.occupancy >= 90
    && (!leader || item.occupancy > leader.occupancy) ? item : leader, null);
  const notices = [];
  if (best) notices.push({ icon: "↗", title: `${best.member.name} lidera em serviços concluídos`, body: `${currency(best.revenue)} em receita registrada no período, baseada em ${best.count} atendimento(s).` });
  if (highOccupancy) notices.push({ icon: "◴", title: `${highOccupancy.member.name} está com alta ocupação`, body: `${highOccupancy.occupancy}% da jornada cadastrada está comprometida por reservas.` });
  if (totals.pending > 0) notices.push({ icon: "%", title: `${currency(totals.pending)} em comissões pendentes`, body: `Valores calculados sobre serviços concluídos entre ${range.label}.` });
  if (!notices.length) notices.push({ icon: "✳", title: "Pronto para acompanhar a equipe", body: "Conclua atendimentos associados a profissionais para gerar insights com base nos registros." });
  document.querySelector("#team-insights").innerHTML = notices.map((item) => `<article class="dashboard-card team-insight-card"><span class="insight-icon">${item.icon}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></div></article>`).join("");
}

function renderCommissionPaymentHistory() {
  const target = document.querySelector("#commission-payment-history");
  const payments = state.commissionPayments.slice().sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  if (!payments.length) {
    target.innerHTML = `<div class="mini-empty">Ainda não há pagamentos de comissão registrados.</div>`;
    return;
  }
  target.innerHTML = payments.slice(0, 30).map((payment) => {
    const member = state.staff.find((item) => item.id === payment.staffId);
    const amount = payment.lines.reduce((total, line) => total + line.amount, 0);
    return `<div class="payment-history-row"><span><strong>${escapeHtml(member?.name || "Profissional removido")}</strong><small>Pago em ${escapeHtml(formatShortDate(payment.paidAt))} · ${payment.lines.length} atendimento(s)</small>${payment.notes ? `<small>${escapeHtml(payment.notes)}</small>` : ""}</span><strong>${currency(amount)}</strong></div>`;
  }).join("");
}

function renderSettings() {
  document.querySelector("#shop-name-input").value = state.shopName;
  document.querySelector("#business-category-input").value = state.businessCategory;
  document.querySelector("#public-slug-input").value = state.publicSlug;
  document.querySelector("#online-booking-input").checked = state.onlineBookingEnabled;
  document.querySelector("#professional-name-input").value = state.professional.name;
  document.querySelector("#professional-phone-input").value = state.professional.phone;
  document.querySelector("#professional-bio-input").value = state.professional.bio;
  document.querySelector("#shop-phone-input").value = state.shopContact.phone;
  document.querySelector("#shop-address-input").value = state.shopContact.address;
  document.querySelector("#business-instagram-input").value = state.shopContact.instagram;
  document.querySelector("#business-support-input").value = state.shopContact.supportUrl;
  document.querySelector("#business-terms-input").value = state.shopContact.termsUrl;
  document.querySelector("#business-privacy-input").value = state.shopContact.privacyUrl;
  document.querySelector("#professional-name-sidebar").textContent = state.professional.name || "Administrador";
  const professionalInitials = initials(state.professional.name, "BF");
  document.querySelector("#professional-avatar").textContent = professionalInitials;
  document.querySelector("#professional-avatar-top").textContent = professionalInitials;
  renderLogo();
  renderBusinessHours();
  renderStaff();
}

function navigate(viewName) {
  const views = {
    overview: elements.overview,
    ecosystem: document.querySelector("#ecosystem-view"),
    agenda: elements.agenda,
    clients: document.querySelector("#clients-view"),
    services: elements.services,
    products: document.querySelector("#products-view"),
    waitlist: document.querySelector("#waitlist-view"),
    finance: document.querySelector("#finance-view"),
    "public-page": document.querySelector("#public-page-view"),
    support: document.querySelector("#support-view"),
    team: elements.team,
    intelligence: document.querySelector("#intelligence-view"),
    settings: elements.settings
  };
  if (!views[viewName]) return;
  Object.entries(views).forEach(([name, element]) => element.classList.toggle("hidden", name !== viewName));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  document.querySelector("#breadcrumb-current").textContent = {
    overview: "Dashboard", ecosystem: "Ecossistema", agenda: "Agenda", clients: "Clientes", team: "Equipe",
    services: "Serviços", products: "Produtos", waitlist: "Lista de espera", finance: "Financeiro",
    "public-page": "Página pública", support: "Suporte", intelligence: "EFA AI", settings: "Configurações"
  }[viewName];
}

function openAppointmentDialog(prefill = {}) {
  clearError(elements.appointmentError);
  elements.appointmentForm.reset();
  const appointmentId = prefill.appointmentId || "";
  document.querySelector("#appointment-edit-id").value = appointmentId;
  document.querySelector("#waitlist-entry-id").value = prefill.waitlistId || "";
  document.querySelector("#appointment-dialog-title").textContent = appointmentId ? "Alterar agendamento" : "Novo agendamento";
  elements.appointmentForm.querySelector('button[type="submit"]').textContent = appointmentId ? "Salvar alterações" : "Salvar agendamento";
  document.querySelector("#appointment-recurring").disabled = Boolean(appointmentId);
  document.querySelector("#recurrence-options").classList.toggle("hidden", Boolean(appointmentId));
  renderServiceOptions(prefill.serviceId || state.services[0]?.id);
  document.querySelector("#appointment-date").value = state.selectedDate || toDateInputValue(new Date());
  if (prefill.customerName) document.querySelector("#customer-name").value = prefill.customerName;
  if (prefill.customerPhone) document.querySelector("#customer-phone").value = EFAHubUtils.formatBrazilianMobile(prefill.customerPhone);
  if (prefill.serviceId) document.querySelector("#service-select").value = prefill.serviceId;
  if (prefill.date) document.querySelector("#appointment-date").value = prefill.date;
  if (prefill.notes) document.querySelector("#appointment-notes").value = prefill.notes;
  renderAppointmentStaffOptions(prefill.staffId || "");
  if (prefill.time && [...document.querySelector("#appointment-time").options].some((option) => option.value === prefill.time)) {
    document.querySelector("#appointment-time").value = prefill.time;
  }
  document.querySelector("#recurrence-options").classList.add("hidden");
  refreshAvailableSlots();
  elements.appointmentDialog.showModal();
  document.querySelector("#customer-name").focus();
}

function normalizePhone(phoneValue) {
  if (!phoneValue) return "";
  return EFAHubUtils.normalizeBrazilianMobile(phoneValue);
}

function hasConflict(date, startTime, duration, excludedId, staffId = "") {
  const start = timeToMinutes(startTime);
  const end = start + duration;
  return state.appointments.some((appointment) => {
    if (appointment.id === excludedId || appointment.date !== date || appointment.status === "cancelled") return false;
    if (staffId && appointment.staffId && appointment.staffId !== staffId) return false;
    const existingStart = timeToMinutes(appointment.time);
    const existingEnd = existingStart + appointment.duration;
    return start < existingEnd && existingStart < end;
  });
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDuration(duration) {
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function staffScheduleFor(staff, date) {
  const business = state.businessHours[DAY_KEYS[date.getDay()]];
  const schedule = staff.inheritsBusinessHours ? business : staff.schedule[DAY_KEYS[date.getDay()]];
  if (!business.open || !schedule?.open) return null;
  const start = Math.max(timeToMinutes(business.start), timeToMinutes(schedule.start));
  const end = Math.min(timeToMinutes(business.end), timeToMinutes(schedule.end));
  if (start >= end) return null;
  const pauses = schedule.breakStart && schedule.breakEnd
    ? [{ start: timeToMinutes(schedule.breakStart), end: timeToMinutes(schedule.breakEnd) }]
    : [];
  const blocks = staff.blocks.filter((block) => block.date === toDateInputValue(date)).map((block) => ({
    start: block.start ? timeToMinutes(block.start) : start,
    end: block.end ? timeToMinutes(block.end) : end
  }));
  return { start, end, pauses: [...pauses, ...blocks] };
}

function getAvailableSlots(dateValue, staffId, duration, excludedId = "") {
  const staff = state.staff.find((member) => member.id === staffId && member.active);
  if (!staff || !dateValue || !Number.isInteger(duration) || duration < 5) return [];
  const date = parseDate(dateValue);
  if (Number.isNaN(date.getTime())) return [];
  const schedule = staffScheduleFor(staff, date);
  if (!schedule) return [];
  const now = new Date();
  const isToday = dateValue === toDateInputValue(now);
  if (dateValue < toDateInputValue(now)) return [];
  const earliest = isToday
    ? Math.max(schedule.start, Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 15) * 15)
    : schedule.start;
  const slots = [];
  for (let start = Math.ceil(earliest / 15) * 15; start + duration <= schedule.end; start += 15) {
    const end = start + duration;
    if (schedule.pauses.some((pause) => start < pause.end && pause.start < end)) continue;
    const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    if (!hasConflict(dateValue, time, duration, excludedId, staffId)) slots.push(time);
  }
  return slots;
}

function renderSmartSuggestions(slots, dateValue) {
  const target = document.querySelector("#smart-suggestions-list");
  if (!target) return;
  if (!slots.length) {
    target.innerHTML = '<p class="field-help">Sem horários disponíveis para sugerir nesta combinação.</p>';
    return;
  }

  const phone = normalizePhone(document.querySelector("#customer-phone").value.trim());
  const customerHistory = phone
    ? state.appointments.filter((item) => normalizePhone(item.customerPhone || "") === phone && item.status !== "cancelled")
    : [];
  const habitualMinutes = customerHistory.length
    ? customerHistory.reduce((total, item) => total + timeToMinutes(item.time), 0) / customerHistory.length
    : null;
  const targetWeekday = parseDate(dateValue).getDay();
  const historicalAttendance = state.appointments.filter((item) =>
    parseDate(item.date).getDay() === targetWeekday && ["completed", "cancelled"].includes(item.status)
  );
  const riskByTime = new Map();
  historicalAttendance.forEach((item) => {
    const hour = item.time.slice(0, 2);
    const score = riskByTime.get(hour) || { completed: 0, cancelled: 0 };
    score[item.status] += 1;
    riskByTime.set(hour, score);
  });
  const habitualSlot = habitualMinutes === null
    ? slots[0]
    : slots.reduce((best, slot) =>
      Math.abs(timeToMinutes(slot) - habitualMinutes) < Math.abs(timeToMinutes(best) - habitualMinutes) ? slot : best
    , slots[0]);
  const attendanceSlot = slots.reduce((best, slot) => {
    const score = riskByTime.get(slot.slice(0, 2));
    if (!score) return best;
    const total = score.completed + score.cancelled;
    const rate = (score.completed + 1) / (total + 2);
    return !best || rate > best.rate ? { slot, rate, count: total } : best;
  }, null);
  const recommendations = [
    { title: "Próximo disponível", time: slots[0], detail: "Primeira opção livre na agenda." },
    {
      title: "Mais próximo do seu hábito",
      time: habitualSlot,
      detail: habitualMinutes === null ? "Ainda sem histórico identificado para este telefone." : "Com base nos seus agendamentos anteriores."
    },
    {
      title: "Menor risco de falta",
      time: attendanceSlot?.slot || slots[0],
      detail: attendanceSlot ? `${Math.round(attendanceSlot.rate * 100)}% de comparecimento em ${attendanceSlot.count} registro(s) locais.` : "Sem histórico suficiente; exibindo o próximo horário livre."
    }
  ];

  target.innerHTML = recommendations.map((item) => `
    <button class="suggestion-card" data-action="select-suggestion" data-time="${escapeHtml(item.time)}" type="button">
      <span>${escapeHtml(item.title)}</span><strong>${escapeHtml(item.time)}</strong><small>${escapeHtml(item.detail)}</small>
    </button>
  `).join("");
}

function refreshAvailableSlots() {
  const select = document.querySelector("#appointment-time");
  if (!select) return;
  const service = state.services.find((item) => item.id === document.querySelector("#service-select").value && item.active);
  const staffId = document.querySelector("#appointment-staff").value;
  const date = document.querySelector("#appointment-date").value;
  const editingId = document.querySelector("#appointment-edit-id").value;
  const note = document.querySelector("#appointment-availability-note");
  const submit = elements.appointmentForm.querySelector('button[type="submit"]');
  if (!service || !staffId || !date) {
    select.innerHTML = '<option value="">Selecione serviço, data e profissional</option>';
    select.disabled = true;
    submit.disabled = true;
    note.textContent = state.staff.some((member) => member.active)
      ? "Selecione o serviço, a data e o profissional para consultar horários válidos."
      : "Cadastre um profissional ativo em Equipe para habilitar agendamentos.";
    renderSmartSuggestions([], date);
    return;
  }
  const slots = getAvailableSlots(date, staffId, service.duration, editingId);
  const selectedTime = select.value;
  select.innerHTML = slots.length
    ? `<option value="">Selecione um horário</option>${slots.map((time) => `<option value="${time}">${time}</option>`).join("")}`
    : '<option value="">Nenhum horário disponível</option>';
  if (slots.includes(selectedTime)) select.value = selectedTime;
  renderSmartSuggestions(slots, date);
  select.disabled = slots.length === 0;
  submit.disabled = slots.length === 0;
  note.textContent = slots.length
    ? `${slots.length} horário(s) disponível(is) · duração ${formatDuration(service.duration)}. Horários calculados por profissional, jornada, pausas, bloqueios e reservas.`
    : `Não há horários disponíveis para este profissional, serviço e data. Confira a jornada ou folgas em Equipe.`;
}

function saveAppointment(event) {
  event.preventDefault();
  clearError(elements.appointmentError);
  const formData = new FormData(elements.appointmentForm);
  const customerName = String(formData.get("customerName") || "").trim();
  const rawPhone = String(formData.get("customerPhone") || "").trim();
  const customerPhone = normalizePhone(rawPhone);
  const service = state.services.find((item) => item.id === formData.get("serviceId") && item.active);
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const staff = state.staff.find((item) => item.id === formData.get("staffId") && item.active);
  const recurring = document.querySelector("#appointment-recurring").checked;
  const recurrenceInterval = document.querySelector("#recurrence-interval").value;
  const recurrenceCount = recurring ? Number(document.querySelector("#recurrence-count").value) : 1;
  const waitlistId = document.querySelector("#waitlist-entry-id").value;

  if (!service) return showError(elements.appointmentError, "Cadastre ou selecione um serviço válido.");
  if (!staff) return showError(elements.appointmentError, "Selecione um profissional ativo em Equipe.");
  if (service.staffIds.length && !service.staffIds.includes(staff.id)) {
    return showError(elements.appointmentError, "Este profissional não está habilitado para o serviço selecionado.");
  }
  if (rawPhone && !customerPhone) return showError(elements.appointmentError, "Informe um celular com DDD e 9 dígitos, como (41) 99999-9999.");
  if (!date || !time || !customerName) return showError(elements.appointmentError, "Preencha nome, data e horário.");
  const editingId = document.querySelector("#appointment-edit-id").value;
  if (editingId) {
    const appointment = state.appointments.find((item) => item.id === editingId && item.status === "scheduled");
    if (!appointment) return showError(elements.appointmentError, "Este agendamento não está mais disponível para alteração.");
    const appointmentStart = parseDate(date);
    appointmentStart.setHours(...time.split(":").map(Number), 0, 0);
    if (appointmentStart < new Date()) return showError(elements.appointmentError, "Escolha uma data e horário futuros.");
    if (!state.businessHours[DAY_KEYS[parseDate(date).getDay()]].open) {
      return showError(elements.appointmentError, "O negócio está fechado nesta data.");
    }
    if (!getAvailableSlots(date, staff.id, service.duration, editingId).includes(time)) {
      return showError(elements.appointmentError, "Este horário não está mais disponível. Escolha uma das opções válidas.");
    }
    const previous = { ...appointment };
    const messageKind = previous.date !== date || previous.time !== time
      ? "rescheduled"
      : previous.staffId !== staff.id ? "professional"
        : previous.serviceId !== service.id ? "service" : "updated";
    const updated = {
      ...appointment,
      customerName,
      customerPhone: customerPhone || "",
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      staffId: staff.id,
      staffName: staff.name,
      messageKind,
      date,
      time,
      notes: String(formData.get("notes") || "").trim()
    };
    Object.assign(appointment, updated);
    recordActivity("updated", `${customerName} atualizou o agendamento para ${date} às ${time}.`, editingId);
    if (!saveState()) {
      Object.assign(appointment, previous);
      state.activity.pop();
      return;
    }
    elements.appointmentDialog.close();
    state.selectedDate = date;
    render();
    navigate("agenda");
    showToast(appointment.customerPhone
      ? "Agendamento atualizado. Use WhatsApp na agenda para avisar o cliente."
      : "Agendamento atualizado neste navegador.");
    return;
  }
  if (!Number.isInteger(recurrenceCount) || recurrenceCount < 1 || recurrenceCount > 12 || (recurring && recurrenceCount < 2)) {
    return showError(elements.appointmentError, "Escolha entre 2 e 12 ocorrências para uma série recorrente.");
  }
  if (recurring && !["7", "14", "month"].includes(recurrenceInterval)) {
    return showError(elements.appointmentError, "Selecione uma frequência recorrente válida.");
  }
  const recurrenceDates = [parseDate(date)];
  for (let index = 1; index < recurrenceCount; index += 1) {
    const next = new Date(recurrenceDates[index - 1]);
    if (recurrenceInterval === "month") {
      const desiredDay = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(desiredDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    } else {
      next.setDate(next.getDate() + Number(recurrenceInterval));
    }
    recurrenceDates.push(next);
  }
  const seriesId = recurring ? crypto.randomUUID() : "";
  const appointments = [];
  for (const [index, occurrenceDate] of recurrenceDates.entries()) {
    const occurrenceDateValue = toDateInputValue(occurrenceDate);
    const appointmentStart = parseDate(occurrenceDateValue);
    appointmentStart.setHours(...time.split(":").map(Number), 0, 0);
    if (appointmentStart < new Date()) return showError(elements.appointmentError, `O horário ${formatShortDate(occurrenceDateValue)} às ${time} já passou.`);
    const businessHours = state.businessHours[DAY_KEYS[occurrenceDate.getDay()]];
    if (!businessHours.open) return showError(elements.appointmentError, `${formatShortDate(occurrenceDateValue)}: o negócio está fechado nesse dia.`);
    if (!getAvailableSlots(occurrenceDateValue, staff.id, service.duration).includes(time)) {
      return showError(elements.appointmentError, `${formatShortDate(occurrenceDateValue)}: ${time} não está disponível. A série não foi criada.`);
    }
    appointments.push({
      id: crypto.randomUUID(),
      customerName,
      customerPhone: customerPhone || "",
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      staffId: staff.id,
      staffName: staff.name,
      messageKind: "created",
      date: occurrenceDateValue,
      time,
      notes: String(formData.get("notes") || "").trim(),
      status: "scheduled",
      ...(recurring ? { recurrenceSeriesId: seriesId, recurrenceIndex: index + 1, recurrenceTotal: recurrenceCount } : {})
    });
  }
  const previousAppointmentCount = state.appointments.length;
  const previousActivityCount = state.activity.length;
  const waitlistEntry = waitlistId ? state.waitlist.find((entry) => entry.id === waitlistId && entry.status === "waiting") : null;
  const previousWaitlistStatus = waitlistEntry?.status;
  appointments.forEach((appointment, index) => {
    recordActivity("created", `${customerName} agendou ${service.name} para ${appointment.date} às ${time}${recurring ? ` (${index + 1}/${recurrenceCount})` : ""}.`, appointment.id);
  });
  state.appointments.push(...appointments);
  if (waitlistEntry) {
    waitlistEntry.status = "booked";
    waitlistEntry.bookedAppointmentId = appointments[0].id;
  }
  if (!saveState()) {
    state.appointments.length = previousAppointmentCount;
    state.activity.length = previousActivityCount;
    if (waitlistEntry) {
      waitlistEntry.status = previousWaitlistStatus;
      delete waitlistEntry.bookedAppointmentId;
    }
    return;
  }
  state.selectedDate = date;
  elements.appointmentDialog.close();
  render();
  navigate("agenda");
  showToast(recurring
    ? `${appointments.length} agendamento(s) recorrente(s) salvos neste navegador.`
    : appointments[0].customerPhone
      ? "Agendamento salvo. Use WhatsApp na agenda para enviar a confirmação."
      : "Agendamento salvo neste navegador.");
}

function openServiceDialog(service) {
  clearError(elements.serviceError);
  elements.serviceForm.reset();
  document.querySelector("#service-id").value = service?.id || "";
  document.querySelector("#service-name").value = service?.name || "";
  document.querySelector("#service-description").value = service?.description || "";
  document.querySelector("#service-price").value = service?.price ?? "";
  document.querySelector("#service-duration").value = formatDuration(service?.duration ?? 30);
  document.querySelector("#service-active").checked = service?.active !== false;
  renderServiceStaffOptions(service?.staffIds || []);
  document.querySelector("#service-dialog-title").textContent = service ? "Editar serviço" : "Novo serviço";
  elements.serviceDialog.showModal();
  document.querySelector("#service-name").focus();
}

function saveService(event) {
  event.preventDefault();
  clearError(elements.serviceError);
  const id = document.querySelector("#service-id").value;
  const name = document.querySelector("#service-name").value.trim();
  const description = document.querySelector("#service-description").value.trim();
  const price = Number(document.querySelector("#service-price").value);
  const durationInput = document.querySelector("#service-duration").value;
  const duration = /^\d{2}:\d{2}$/.test(durationInput) ? timeToMinutes(durationInput) : NaN;
  if (!name || description.length < 3 || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 5 || duration > 480 || duration % 5 !== 0) {
    return showError(elements.serviceError, "Informe nome, descrição, preço e uma duração válida para o serviço.");
  }
  const previous = id ? state.services.find((item) => item.id === id) : null;
  const staffIds = [...document.querySelector("#service-staff").selectedOptions].map((option) => option.value);
  const service = {
    id: id || crypto.randomUUID(),
    name: name.slice(0, 60),
    description: description.slice(0, 240),
    price: Math.round(price * 100) / 100,
    duration,
    active: document.querySelector("#service-active").checked,
    staffIds
  };
  if (previous) state.services = state.services.map((item) => item.id === id ? service : item);
  else state.services.push(service);
  if (!saveState()) {
    if (previous) state.services = state.services.map((item) => item.id === id ? previous : item);
    else state.services = state.services.filter((item) => item.id !== service.id);
    return;
  }
  elements.serviceDialog.close();
  render();
  showToast(previous ? "Serviço atualizado." : "Serviço cadastrado.");
}

function renderServiceStaffOptions(selectedIds = []) {
  const select = document.querySelector("#service-staff");
  const selected = new Set(selectedIds);
  const eligibleStaff = state.staff.filter((member) => member.active || selected.has(member.id));
  select.innerHTML = eligibleStaff.map((member) => `<option value="${escapeHtml(member.id)}" ${selected.has(member.id) ? "selected" : ""}>${escapeHtml(member.name)}${member.active ? "" : " · inativo"}</option>`).join("");
  select.disabled = eligibleStaff.length === 0;
  document.querySelector("#service-staff-help").textContent = eligibleStaff.length
    ? "Sem seleção, todos os profissionais ativos podem realizar este serviço."
    : "Cadastre um profissional ativo em Equipe para habilitar este serviço.";
}

function addInventoryMovement(productId, type, quantity, note) {
  state.inventoryMovements.push({
    id: crypto.randomUUID(),
    productId,
    type,
    quantity,
    note,
    createdAt: new Date().toISOString()
  });
  state.inventoryMovements = state.inventoryMovements.slice(-500);
}

function resetProductForm() {
  document.querySelector("#product-form").reset();
  document.querySelector("#product-id").value = "";
  document.querySelector("#product-stock").value = "0";
  document.querySelector("#product-min-stock").value = "0";
  document.querySelector("#product-form-title").textContent = "Novo produto";
  document.querySelector("#save-product").textContent = "Cadastrar produto";
  document.querySelector("#cancel-product-edit").classList.add("hidden");
}

function saveProduct(event) {
  event.preventDefault();
  const id = document.querySelector("#product-id").value;
  const name = document.querySelector("#product-name").value.trim();
  const sku = document.querySelector("#product-sku").value.trim().slice(0, 40);
  const price = Number(document.querySelector("#product-price").value);
  const costInput = document.querySelector("#product-cost").value;
  const cost = costInput === "" ? null : Number(costInput);
  const stock = Number(document.querySelector("#product-stock").value);
  const minStock = Number(document.querySelector("#product-min-stock").value);
  if (!name || !Number.isFinite(price) || price < 0 || (cost !== null && (!Number.isFinite(cost) || cost < 0))
    || !Number.isInteger(stock) || stock < 0 || !Number.isInteger(minStock) || minStock < 0) {
    return showToast("Confira nome, preço, custo e quantidades do produto.");
  }
  if (sku && state.products.some((product) => product.id !== id && product.sku.toLocaleLowerCase("pt-BR") === sku.toLocaleLowerCase("pt-BR"))) {
    return showToast("Este SKU já está cadastrado em outro produto.");
  }
  const existing = id ? state.products.find((product) => product.id === id) : null;
  const product = { id: id || crypto.randomUUID(), name: name.slice(0, 80), sku, price: Math.round(price * 100) / 100, cost: cost === null ? null : Math.round(cost * 100) / 100, stock, minStock };
  const previousProducts = state.products.slice();
  const previousMovements = state.inventoryMovements.slice();
  if (existing) {
    state.products = state.products.map((item) => item.id === id ? product : item);
    const difference = stock - existing.stock;
    if (difference) addInventoryMovement(product.id, difference > 0 ? "in" : "out", Math.abs(difference), "Ajuste no cadastro do produto");
  } else {
    state.products.push(product);
    if (stock > 0) addInventoryMovement(product.id, "initial", stock, "Estoque inicial");
  }
  if (!saveState()) {
    state.products = previousProducts;
    state.inventoryMovements = previousMovements;
    return;
  }
  resetProductForm();
  render();
  showToast(existing ? "Produto atualizado." : "Produto cadastrado.");
}

function editProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  document.querySelector("#product-id").value = product.id;
  document.querySelector("#product-name").value = product.name;
  document.querySelector("#product-sku").value = product.sku;
  document.querySelector("#product-price").value = product.price;
  document.querySelector("#product-cost").value = product.cost ?? "";
  document.querySelector("#product-stock").value = product.stock;
  document.querySelector("#product-min-stock").value = product.minStock;
  document.querySelector("#product-form-title").textContent = "Editar produto";
  document.querySelector("#save-product").textContent = "Salvar alterações";
  document.querySelector("#cancel-product-edit").classList.remove("hidden");
  document.querySelector("#product-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

function adjustProductStock(id, direction) {
  const product = state.products.find((item) => item.id === id);
  const quantityInput = [...document.querySelectorAll("[data-stock-quantity]")].find((input) => input.dataset.stockQuantity === id);
  const quantity = Number(quantityInput?.value);
  if (!product || !Number.isInteger(quantity) || quantity <= 0) return showToast("Informe uma quantidade inteira maior que zero.");
  const difference = direction === "in" ? quantity : -quantity;
  if (product.stock + difference < 0) return showToast("A saída não pode ser maior que o estoque disponível.");
  const previousStock = product.stock;
  const previousMovements = state.inventoryMovements.slice();
  product.stock += difference;
  addInventoryMovement(product.id, direction, quantity, direction === "in" ? "Entrada manual" : "Saída manual");
  if (!saveState()) {
    product.stock = previousStock;
    state.inventoryMovements = previousMovements;
    return;
  }
  render();
  showToast(direction === "in" ? "Entrada de estoque registrada." : "Saída de estoque registrada.");
}

function removeProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  if (state.sales.some((sale) => sale.productId === id)) return showToast("Este produto possui histórico de vendas e não pode ser removido. Ajuste o estoque para zero.");
  if (!window.confirm(`Remover “${product.name}” do catálogo?`)) return;
  const previousProducts = state.products.slice();
  const previousMovements = state.inventoryMovements.slice();
  state.products = state.products.filter((item) => item.id !== id);
  state.inventoryMovements = state.inventoryMovements.filter((movement) => movement.productId !== id);
  if (!saveState()) {
    state.products = previousProducts;
    state.inventoryMovements = previousMovements;
    return;
  }
  render();
  showToast("Produto removido.");
}

function registerProductSale(event) {
  event.preventDefault();
  const product = state.products.find((item) => item.id === document.querySelector("#sale-product").value);
  const quantity = Number(document.querySelector("#sale-quantity").value);
  const paymentMethod = document.querySelector("#sale-payment-method").value;
  if (!["cash", "pix", "card", "receivable"].includes(paymentMethod)) return showToast("Selecione uma forma de pagamento válida.");
  if (!product || !Number.isInteger(quantity) || quantity < 1) return showToast("Selecione um produto e uma quantidade válida.");
  if (quantity > product.stock) return showToast(`Estoque insuficiente. Disponível: ${product.stock} unidade(s).`);
  const sale = {
    id: crypto.randomUUID(),
    productId: product.id,
    quantity,
    unitPrice: product.price,
    total: Math.round(product.price * quantity * 100) / 100,
    paymentMethod,
    paymentStatus: paymentMethod === "receivable" ? "pending" : "received",
    createdAt: new Date().toISOString()
  };
  const previousStock = product.stock;
  const previousSales = state.sales.slice();
  const previousMovements = state.inventoryMovements.slice();
  product.stock -= quantity;
  state.sales.push(sale);
  addInventoryMovement(product.id, "sale", quantity, `Venda ${sale.id}`);
  recordActivity("sale", `Venda manual de ${quantity} × ${product.name} (${currency(sale.total)}).`);
  if (!saveState()) {
    product.stock = previousStock;
    state.sales = previousSales;
    state.inventoryMovements = previousMovements;
    state.activity.pop();
    return;
  }
  document.querySelector("#product-sale-form").reset();
  document.querySelector("#sale-quantity").value = "1";
  render();
  showToast(`Venda registrada como ${sale.paymentStatus === "pending" ? "a receber" : "recebida (lançamento manual)"}.`);
}

function refundProductSale(id) {
  const sale = state.sales.find((item) => item.id === id && item.paymentStatus !== "refunded");
  if (!sale) return;
  if (!window.confirm("Estornar este lançamento e devolver os itens ao estoque? Isso altera apenas os registros locais; não realiza reembolso financeiro.")) return;
  const product = state.products.find((item) => item.id === sale.productId);
  const oldStatus = sale.paymentStatus;
  const oldStock = product?.stock;
  const previousMovements = state.inventoryMovements.slice();
  const previousActivity = state.activity.slice();
  sale.paymentStatus = "refunded";
  if (product) {
    product.stock += sale.quantity;
    addInventoryMovement(product.id, "refund", sale.quantity, `Estorno local ${sale.id}`);
  }
  recordActivity("refund", `Estorno local da venda ${sale.id}; nenhum pagamento foi processado.`);
  if (!saveState()) {
    sale.paymentStatus = oldStatus;
    if (product) product.stock = oldStock;
    state.inventoryMovements = previousMovements;
    state.activity = previousActivity;
    return;
  }
  render();
  showToast("Lançamento estornado localmente; nenhum dinheiro foi transferido.");
}

function addWaitlistEntry(event) {
  event.preventDefault();
  const customerName = document.querySelector("#waitlist-name").value.trim();
  const rawPhone = document.querySelector("#waitlist-phone").value.trim();
  const customerPhone = normalizePhone(rawPhone);
  const serviceId = document.querySelector("#waitlist-service").value;
  const preferredDate = document.querySelector("#waitlist-date").value;
  if (!customerName || !state.services.some((service) => service.id === serviceId && service.active)) return showToast("Informe o nome e selecione um serviço ativo válido.");
  if (rawPhone && !customerPhone) return showToast("Informe um telefone com DDD válido ou deixe o campo vazio.");
  if (!preferredDate || preferredDate < toDateInputValue(new Date())) return showToast("Escolha uma data de hoje em diante.");
  const entry = { id: crypto.randomUUID(), customerName: customerName.slice(0, 80), customerPhone: customerPhone || "", serviceId, preferredDate, status: "waiting", createdAt: new Date().toISOString() };
  state.waitlist.push(entry);
  recordActivity("waitlist", `${customerName} entrou na lista de espera para ${state.services.find((service) => service.id === serviceId).name}.`);
  if (!saveState()) {
    state.waitlist = state.waitlist.filter((item) => item.id !== entry.id);
    state.activity.pop();
    return;
  }
  document.querySelector("#waitlist-form").reset();
  document.querySelector("#waitlist-date").min = toDateInputValue(new Date());
  render();
  showToast("Cliente adicionado à lista de espera local.");
}

function removeWaitlistEntry(id) {
  const entry = state.waitlist.find((item) => item.id === id && item.status === "waiting");
  if (!entry || !window.confirm(`Remover ${entry.customerName} da lista de espera?`)) return;
  state.waitlist = state.waitlist.filter((item) => item.id !== id);
  if (!saveState()) {
    state.waitlist.push(entry);
    return;
  }
  renderWaitlist();
  showToast("Cliente removido da lista.");
}

function openWaitlistBooking(id) {
  const entry = state.waitlist.find((item) => item.id === id && item.status === "waiting");
  if (!entry) return;
  if (!state.services.some((service) => service.id === entry.serviceId && service.active)) {
    return showToast("O serviço desta solicitação está inativo. Edite a lista ou reative o serviço antes de agendar.");
  }
  state.selectedDate = entry.preferredDate;
  render();
  openAppointmentDialog({
    waitlistId: entry.id,
    customerName: entry.customerName,
    customerPhone: entry.customerPhone,
    serviceId: entry.serviceId,
    date: entry.preferredDate
  });
}

function createSupportTicket(event) {
  event.preventDefault();
  const message = document.querySelector("#support-message").value.trim();
  if (message.length < 10) return showToast("Descreva a solicitação com pelo menos 10 caracteres.");
  const categories = { account: "Conta e acesso", schedule: "Agenda e agendamento", finance: "Financeiro", privacy: "Privacidade e dados", other: "Outro assunto" };
  const category = document.querySelector("#support-category").value;
  if (!Object.prototype.hasOwnProperty.call(categories, category)) return showToast("Selecione um assunto válido para a solicitação.");
  const ticket = { id: crypto.randomUUID(), category, categoryLabel: categories[category] || categories.other, message: message.slice(0, 1000), status: "local", createdAt: new Date().toISOString() };
  state.supportTickets.push(ticket);
  if (!saveState()) {
    state.supportTickets = state.supportTickets.filter((item) => item.id !== ticket.id);
    return;
  }
  document.querySelector("#support-form").reset();
  renderSupport();
  showToast("Solicitação salva somente neste navegador; não foi enviada ao suporte.");
}

function exportSalesCsv() {
  if (!state.sales.length) return showToast("Não há vendas de produtos para exportar.");
  const columns = ["Data", "Produto", "Quantidade", "Valor unitário (R$)", "Total (R$)", "Forma de pagamento", "Status"];
  const rows = state.sales.map((sale) => [
    sale.createdAt.slice(0, 10),
    state.products.find((product) => product.id === sale.productId)?.name || "Produto removido",
    sale.quantity,
    sale.unitPrice.toFixed(2).replace(".", ","),
    sale.total.toFixed(2).replace(".", ","),
    paymentMethodLabel(sale.paymentMethod),
    sale.paymentStatus === "received" ? "Recebido - manual" : sale.paymentStatus === "pending" ? "A receber" : "Estornado localmente"
  ]);
  const csv = `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `efahub-vendas-${toDateInputValue(new Date())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${rows.length} venda(s) exportada(s) em CSV.`);
}

function updateAppointmentStatus(id, status) {
  const appointment = state.appointments.find((item) => item.id === id);
  if (!appointment || appointment.status !== "scheduled") return;
  if (status === "cancelled" && !window.confirm(`Cancelar o agendamento de ${appointment.customerName} em ${formatShortDate(appointment.date)} às ${appointment.time}?`)) return;
  if (status === "completed") {
    const appointmentDateTime = parseDate(appointment.date);
    appointmentDateTime.setHours(...appointment.time.split(":").map(Number), 0, 0);
    if (appointmentDateTime > new Date()) {
      showToast("Um atendimento só pode ser concluído após o horário agendado.");
      return;
    }
  }
  const previous = {
    status: appointment.status,
    commissionRate: appointment.commissionRate,
    commissionType: appointment.commissionType,
    commissionValue: appointment.commissionValue,
    commissionAmount: appointment.commissionAmount
  };
  appointment.status = status;
  if (status === "completed") {
    const staff = state.staff.find((member) => member.id === appointment.staffId);
    appointment.commissionType = staff?.commissionType || "percentage";
    appointment.commissionValue = staff?.commissionValue ?? staff?.commissionRate ?? 0;
    appointment.commissionRate = appointment.commissionType === "percentage" ? appointment.commissionValue : 0;
    appointment.commissionAmount = appointment.commissionType === "fixed"
      ? Math.min(appointment.price, appointment.commissionValue)
      : Math.round(appointment.price * appointment.commissionValue) / 100;
  }
  recordActivity(status, `${appointment.customerName}: atendimento ${status === "completed" ? "concluído" : "cancelado"}.`, id);
  if (!saveState()) {
    appointment.status = previous.status;
    if (previous.commissionRate === undefined) delete appointment.commissionRate;
    else appointment.commissionRate = previous.commissionRate;
    if (previous.commissionType === undefined) delete appointment.commissionType;
    else appointment.commissionType = previous.commissionType;
    if (previous.commissionValue === undefined) delete appointment.commissionValue;
    else appointment.commissionValue = previous.commissionValue;
    if (previous.commissionAmount === undefined) delete appointment.commissionAmount;
    else appointment.commissionAmount = previous.commissionAmount;
    state.activity.pop();
    return;
  }
  render();
  if (status === "completed") showToast("Atendimento marcado como concluído.");
  else {
    showToast(appointment.customerPhone
      ? "Agendamento cancelado. Use WhatsApp na agenda para avisar o cliente."
      : "Agendamento cancelado.");
  }
}

function openWhatsApp(id, kind) {
  const appointment = state.appointments.find((item) => item.id === id);
  if (!appointment || !appointment.customerPhone) return;
  const serviceName = state.services.find((service) => service.id === appointment.serviceId)?.name
    || appointment.serviceName || "Atendimento";
  const staffName = state.staff.find((member) => member.id === appointment.staffId)?.name
    || appointment.staffName || "A definir";
  const message = EFAHubUtils.buildAppointmentMessage({
    kind: kind || (appointment.status === "cancelled" ? "cancelled" : appointment.messageKind || "created"),
    customerName: appointment.customerName,
    shopName: state.shopName,
    serviceName,
    staffName,
    date: appointment.date,
    time: appointment.time
  });
  const phone = normalizePhone(appointment.customerPhone);
  if (!phone) {
    showToast("Não foi possível preparar a mensagem: o celular do cliente precisa de DDD e 9 dígitos.");
    return;
  }
  const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  if (!window.open(link, "_blank", "noopener,noreferrer")) {
    showToast("O navegador bloqueou a abertura do WhatsApp. Permita pop-ups e tente novamente.");
    return;
  }
  showToast("Mensagem preparada no WhatsApp. Revise e envie manualmente.");
}

function removeService(id) {
  const service = state.services.find((item) => item.id === id);
  if (!service) return;
  if (state.waitlist.some((entry) => entry.serviceId === id && entry.status === "waiting")) {
    return showToast("Este serviço está vinculado a clientes na lista de espera. Resolva essas solicitações antes de removê-lo.");
  }
  if (state.appointments.some((appointment) => appointment.serviceId === id && appointment.status !== "cancelled")) {
    showToast("Este serviço está ligado a atendimentos ativos e não pode ser removido ainda.");
    return;
  }
  if (!window.confirm(`Remover o serviço “${service.name}”?`)) return;
  state.services = state.services.filter((item) => item.id !== id);
  if (!saveState()) {
    state.services.push(service);
    return;
  }
  render();
  showToast("Serviço removido.");
}

function restoreDemoData() {
  if (!window.confirm("Restaurar a demonstração? Isso apaga os agendamentos, produtos, vendas, lista de espera, solicitações, equipe e configurações salvos neste navegador.")) return;
  state.shopName = "Barbearia Demo";
  state.businessCategory = "barbershop";
  state.publicSlug = "barbearia-demo";
  state.onlineBookingEnabled = false;
  state.shopLogo = "";
  state.professional = { name: "", phone: "", bio: "" };
  state.shopContact = { phone: "", address: "", instagram: "", supportUrl: "", termsUrl: "", privacyUrl: "" };
  state.businessHours = structuredClone(DEFAULT_BUSINESS_HOURS);
  state.staff = [];
  state.commissionPayments = [];
  state.services = structuredClone(DEFAULT_SERVICES);
  state.appointments = [];
  state.products = [];
  state.inventoryMovements = [];
  state.sales = [];
  state.waitlist = [];
  state.supportTickets = [];
  state.activity = [];
  state.selectedDate = toDateInputValue(new Date());
  if (!saveState()) return;
  render();
  navigate("overview");
  showToast("Dados da demonstração restaurados.");
}

function validateSettingsPhone(value, fieldLabel) {
  const phone = value.trim();
  if (phone && !normalizePhone(phone)) return `${fieldLabel}: informe celular com DDD e 9 dígitos, como (41) 99999-9999.`;
  return "";
}

function saveSettings(event) {
  event.preventDefault();
  const previous = {
    shopName: state.shopName,
    businessCategory: state.businessCategory,
    publicSlug: state.publicSlug,
    onlineBookingEnabled: state.onlineBookingEnabled,
    professional: structuredClone(state.professional),
    shopContact: structuredClone(state.shopContact),
    businessHours: structuredClone(state.businessHours)
  };
  const professionalPhone = document.querySelector("#professional-phone-input").value.trim();
  const shopPhone = document.querySelector("#shop-phone-input").value.trim();
  const phoneError = validateSettingsPhone(professionalPhone, "Telefone profissional")
    || validateSettingsPhone(shopPhone, "Telefone do negócio");
  if (phoneError) {
    showToast(phoneError);
    return;
  }
  const rawSlug = document.querySelector("#public-slug-input").value.trim();
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugPattern.test(rawSlug) || rawSlug.length > 40) {
    showToast("Use no identificador apenas letras minúsculas, números e hífens entre palavras.");
    return;
  }
  const urlFields = [
    ["business-instagram-input", "Instagram"],
    ["business-support-input", "Suporte"],
    ["business-terms-input", "Termos de Uso"],
    ["business-privacy-input", "Política de Privacidade"]
  ];
  for (const [id, label] of urlFields) {
    const value = document.querySelector(`#${id}`).value.trim();
    if (value && !safeExternalUrl(value)) {
      showToast(`${label}: informe uma URL válida iniciada por https://.`);
      return;
    }
  }

  const nextHours = {};
  for (const day of DAY_KEYS) {
    const open = document.querySelector(`[data-day-open="${day}"]`).checked;
    const start = document.querySelector(`[data-day-start="${day}"]`).value;
    const end = document.querySelector(`[data-day-end="${day}"]`).value;
    if (open && (!start || !end || timeToMinutes(start) >= timeToMinutes(end))) {
      showToast(`Confira os horários de ${DAY_LABELS[DAY_KEYS.indexOf(day)]}: o fechamento deve ser depois da abertura.`);
      return;
    }
    nextHours[day] = { open, start, end };
  }

  state.shopName = document.querySelector("#shop-name-input").value.trim().slice(0, 60) || "Meu negócio";
  state.businessCategory = document.querySelector("#business-category-input").value;
  state.publicSlug = rawSlug;
  state.onlineBookingEnabled = document.querySelector("#online-booking-input").checked;
  state.professional = {
    name: document.querySelector("#professional-name-input").value.trim().slice(0, 80),
    phone: professionalPhone ? EFAHubUtils.formatBrazilianMobile(professionalPhone) : "",
    bio: document.querySelector("#professional-bio-input").value.trim().slice(0, 240)
  };
  state.shopContact = {
    phone: shopPhone ? EFAHubUtils.formatBrazilianMobile(shopPhone) : "",
    address: document.querySelector("#shop-address-input").value.trim().slice(0, 140),
    instagram: safeExternalUrl(document.querySelector("#business-instagram-input").value),
    supportUrl: safeExternalUrl(document.querySelector("#business-support-input").value),
    termsUrl: safeExternalUrl(document.querySelector("#business-terms-input").value),
    privacyUrl: safeExternalUrl(document.querySelector("#business-privacy-input").value)
  };
  state.businessHours = nextHours;
  if (!saveState()) {
    Object.assign(state, previous);
    render();
    return;
  }
  render();
  showToast("Configurações do negócio salvas neste navegador.");
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo de imagem."));
    reader.readAsDataURL(blob);
  });
}

async function prepareLogo(file) {
  const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedTypes.includes(file.type)) throw new Error("Escolha uma imagem PNG, JPG ou WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("A imagem precisa ter no máximo 8 MB.");
  const image = await createImageBitmap(file);
  if (image.width * image.height > 40_000_000) {
    image.close();
    throw new Error("A resolução da imagem é muito alta. Escolha uma imagem menor.");
  }
  const scale = Math.min(1, 512 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    image.close();
    throw new Error("Não foi possível preparar a imagem neste navegador.");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Não foi possível converter a imagem para o formato da logo.");
  return blobToDataUrl(blob);
}

async function saveShopLogo(file) {
  clearError(document.querySelector("#logo-error"));
  const previousLogo = state.shopLogo;
  try {
    state.shopLogo = await prepareLogo(file);
    if (!saveState()) {
      state.shopLogo = previousLogo;
      renderLogo();
      return;
    }
    renderLogo();
    showToast("Logo do negócio atualizada.");
  } catch (error) {
    console.error("Não foi possível salvar a logo do negócio.", error);
    state.shopLogo = previousLogo;
    renderLogo();
    showError(document.querySelector("#logo-error"), error.message || "Não foi possível carregar esta imagem.");
  } finally {
    document.querySelector("#shop-logo-input").value = "";
  }
}

function removeShopLogo() {
  if (!state.shopLogo) return showToast("Nenhuma logo foi adicionada.");
  const previousLogo = state.shopLogo;
  state.shopLogo = "";
  if (!saveState()) {
    state.shopLogo = previousLogo;
    return;
  }
  renderLogo();
  showToast("Logo removida.");
}

function defaultStaffSchedule() {
  return Object.fromEntries(DAY_KEYS.map((day) => [day, {
    ...state.businessHours[day],
    breakStart: "",
    breakEnd: ""
  }]));
}

function renderStaffScheduleEditor(schedule = defaultStaffSchedule()) {
  document.querySelector("#staff-weekly-schedule").innerHTML = DAY_KEYS.map((day, index) => {
    const item = schedule[day];
    return `<div class="staff-day-row">
      <label class="day-toggle"><input type="checkbox" data-staff-day-open="${day}" ${item.open ? "checked" : ""}><span>${DAY_LABELS[index]}</span></label>
      <div class="staff-day-times">
        <label><span>Início</span><input class="text-input" type="time" data-staff-day-start="${day}" value="${item.start}" ${item.open ? "" : "disabled"}></label>
        <label><span>Fim</span><input class="text-input" type="time" data-staff-day-end="${day}" value="${item.end}" ${item.open ? "" : "disabled"}></label>
        <label><span>Intervalo início</span><input class="text-input" type="time" data-staff-break-start="${day}" value="${item.breakStart || ""}" ${item.open ? "" : "disabled"}></label>
        <label><span>Intervalo fim</span><input class="text-input" type="time" data-staff-break-end="${day}" value="${item.breakEnd || ""}" ${item.open ? "" : "disabled"}></label>
      </div>
    </div>`;
  }).join("");
  const inherit = document.querySelector("#staff-inherit-hours").checked;
  document.querySelectorAll("#staff-weekly-schedule input").forEach((input) => {
    if (input.type !== "checkbox") input.disabled = inherit || !document.querySelector(`[data-staff-day-open="${input.dataset.staffDayStart || input.dataset.staffDayEnd || input.dataset.staffBreakStart || input.dataset.staffBreakEnd}"]`)?.checked;
  });
}

function updateStaffScheduleDisabled() {
  const inherit = document.querySelector("#staff-inherit-hours").checked;
  for (const day of DAY_KEYS) {
    const open = document.querySelector(`[data-staff-day-open="${day}"]`).checked && !inherit;
    document.querySelector(`[data-staff-day-start="${day}"]`).disabled = !open;
    document.querySelector(`[data-staff-day-end="${day}"]`).disabled = !open;
    document.querySelector(`[data-staff-break-start="${day}"]`).disabled = !open;
    document.querySelector(`[data-staff-break-end="${day}"]`).disabled = !open;
  }
}

function readStaffSchedule() {
  const inherit = document.querySelector("#staff-inherit-hours").checked;
  if (inherit) return defaultStaffSchedule();
  const schedule = {};
  for (const [index, day] of DAY_KEYS.entries()) {
    const open = document.querySelector(`[data-staff-day-open="${day}"]`).checked;
    const start = document.querySelector(`[data-staff-day-start="${day}"]`).value;
    const end = document.querySelector(`[data-staff-day-end="${day}"]`).value;
    const breakStart = document.querySelector(`[data-staff-break-start="${day}"]`).value;
    const breakEnd = document.querySelector(`[data-staff-break-end="${day}"]`).value;
    const business = state.businessHours[day];
    if (open && (!business.open || !start || !end || timeToMinutes(start) >= timeToMinutes(end)
      || timeToMinutes(start) < timeToMinutes(business.start) || timeToMinutes(end) > timeToMinutes(business.end))) {
      throw new Error(`${DAY_LABELS[index]}: jornada individual deve estar dentro do horário do negócio.`);
    }
    if (open && Boolean(breakStart) !== Boolean(breakEnd)) throw new Error(`${DAY_LABELS[index]}: informe início e fim do intervalo.`);
    if (open && breakStart && (timeToMinutes(breakStart) >= timeToMinutes(breakEnd)
      || timeToMinutes(breakStart) < timeToMinutes(start) || timeToMinutes(breakEnd) > timeToMinutes(end))) {
      throw new Error(`${DAY_LABELS[index]}: intervalo precisa estar dentro da jornada.`);
    }
    schedule[day] = { open, start: start || business.start, end: end || business.end, breakStart, breakEnd };
  }
  return schedule;
}

function renderStaffBlocks() {
  const target = document.querySelector("#staff-block-list");
  target.innerHTML = staffDraftBlocks.length
    ? staffDraftBlocks.map((block) => `<div class="staff-block-row"><span><strong>${escapeHtml(formatShortDate(block.date))} · ${block.start ? `${escapeHtml(block.start)}–${escapeHtml(block.end)}` : "Dia todo"}</strong><small>${escapeHtml(block.note || "Folga ou bloqueio")}</small></span><button class="text-button staff-remove" data-action="remove-staff-block" data-id="${escapeHtml(block.id)}" type="button" aria-label="Remover bloqueio">Remover</button></div>`).join("")
    : `<p class="field-help">Nenhuma folga ou bloqueio pontual cadastrado.</p>`;
}

function resetStaffForm() {
  const form = document.querySelector("#staff-form");
  form.reset();
  document.querySelector("#staff-id").value = "";
  document.querySelector("#staff-active-input").value = "true";
  document.querySelector("#staff-joined-input").value = toDateInputValue(new Date());
  document.querySelector("#staff-commission-input").value = "40";
  document.querySelector("#staff-commission-type-input").value = "percentage";
  document.querySelector("#staff-commission-input").max = "100";
  document.querySelector("#staff-commission-value-label").textContent = "Percentual (%)";
  updateCommissionInput();
  document.querySelector("#staff-inherit-hours").checked = true;
  document.querySelector("#staff-form-title").textContent = "Novo profissional";
  document.querySelector("#save-staff").textContent = "Adicionar à equipe";
  document.querySelector("#cancel-staff-edit").classList.add("hidden");
  document.querySelector("#staff-photo-input").value = "";
  document.querySelector("#staff-photo-preview").classList.add("hidden");
  document.querySelector("#remove-staff-photo").classList.add("hidden");
  staffDraftPhoto = "";
  staffDraftBlocks = [];
  renderStaffScheduleEditor();
  updateStaffScheduleDisabled();
  renderStaffBlocks();
}

let staffDraftPhoto = "";

function editStaffMember(id) {
  const member = state.staff.find((item) => item.id === id);
  if (!member) return;
  navigate("team");
  document.querySelector("#staff-id").value = member.id;
  document.querySelector("#staff-name-input").value = member.name;
  document.querySelector("#staff-role-input").value = member.role;
  document.querySelector("#staff-phone-input").value = EFAHubUtils.formatBrazilianMobile(member.phone);
  document.querySelector("#staff-email-input").value = member.email;
  document.querySelector("#staff-joined-input").value = member.joinedAt;
  document.querySelector("#staff-commission-type-input").value = member.commissionType || "percentage";
  document.querySelector("#staff-commission-input").value = String(member.commissionValue ?? member.commissionRate);
  updateCommissionInput();
  document.querySelector("#staff-active-input").value = String(member.active);
  document.querySelector("#staff-inherit-hours").checked = member.inheritsBusinessHours;
  document.querySelector("#staff-form-title").textContent = `Editar ${member.name}`;
  document.querySelector("#save-staff").textContent = "Salvar profissional";
  document.querySelector("#cancel-staff-edit").classList.remove("hidden");
  staffDraftPhoto = member.photo;
  const preview = document.querySelector("#staff-photo-preview");
  preview.classList.toggle("hidden", !staffDraftPhoto);
  if (staffDraftPhoto) preview.src = staffDraftPhoto;
  document.querySelector("#remove-staff-photo").classList.toggle("hidden", !staffDraftPhoto);
  staffDraftBlocks = member.blocks.map((block) => ({ ...block }));
  renderStaffScheduleEditor(member.schedule);
  updateStaffScheduleDisabled();
  renderStaffBlocks();
  document.querySelector("#staff-form").scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#staff-name-input").focus({ preventScroll: true });
}

function addStaffBlock() {
  const date = document.querySelector("#staff-block-date").value;
  const start = document.querySelector("#staff-block-start").value;
  const end = document.querySelector("#staff-block-end").value;
  const note = document.querySelector("#staff-block-note").value.trim();
  if (!date || date < toDateInputValue(new Date())) return showToast("Selecione uma data de bloqueio a partir de hoje.");
  if (Boolean(start) !== Boolean(end) || (start && timeToMinutes(start) >= timeToMinutes(end))) return showToast("Informe um intervalo válido ou deixe ambos os horários vazios para bloquear o dia todo.");
  staffDraftBlocks.push({ id: crypto.randomUUID(), date, start, end, note });
  document.querySelector("#staff-block-start").value = "";
  document.querySelector("#staff-block-end").value = "";
  document.querySelector("#staff-block-note").value = "";
  renderStaffBlocks();
}

function validateStaffPhone(value) {
  return EFAHubUtils.isValidBrazilianMobile(value);
}

function updateCommissionInput() {
  const type = document.querySelector("#staff-commission-type-input").value;
  const amountInput = document.querySelector("#staff-commission-input");
  const isFixed = type === "fixed";
  document.querySelector("#staff-commission-value-label").textContent = isFixed
    ? "Valor fixo por atendimento (R$)"
    : "Percentual (%)";
  amountInput.max = isFixed ? "99999" : "100";
  amountInput.step = isFixed ? "0.01" : "0.01";
  if (isFixed && amountInput.value === "40") amountInput.value = "0";
  else if (!isFixed && amountInput.value === "0") amountInput.value = "40";
}

function saveStaffMember(event) {
  event.preventDefault();
  const id = document.querySelector("#staff-id").value;
  const name = document.querySelector("#staff-name-input").value.trim();
  const role = document.querySelector("#staff-role-input").value.trim() || "Profissional";
  const phone = document.querySelector("#staff-phone-input").value.trim();
  const email = document.querySelector("#staff-email-input").value.trim();
  const joinedAt = document.querySelector("#staff-joined-input").value || toDateInputValue(new Date());
  const commissionType = document.querySelector("#staff-commission-type-input").value;
  const commissionRate = Number(document.querySelector("#staff-commission-input").value || (commissionType === "fixed" ? "0" : "40"));
  const active = document.querySelector("#staff-active-input").value === "true";
  if (!name || !phone) return showToast("Preencha o nome e o telefone do profissional.");
  if (!validateStaffPhone(phone)) return showToast("Informe um celular com DDD e 9 dígitos, como (41) 99999-9999.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast("Informe um e-mail válido ou deixe o campo vazio.");
  if (joinedAt > toDateInputValue(new Date())) return showToast("A data de entrada não pode estar no futuro.");
  if (!Number.isFinite(commissionRate) || commissionRate < 0
    || (commissionType === "percentage" && commissionRate > 100)
    || !["percentage", "fixed"].includes(commissionType)) {
    return showToast(commissionType === "fixed"
      ? "Informe uma comissão fixa igual ou maior que zero."
      : "A comissão percentual deve estar entre 0% e 100%.");
  }
  let schedule;
  try {
    schedule = readStaffSchedule();
  } catch (error) {
    showToast(error.message);
    return;
  }
  const previous = id ? state.staff.find((member) => member.id === id) : null;
  const member = {
    id: id || crypto.randomUUID(), name, role, phone: EFAHubUtils.formatBrazilianMobile(phone), email, joinedAt, active,
    commissionType, commissionValue: commissionRate,
    commissionRate: commissionType === "percentage" ? commissionRate : 0,
    photo: staffDraftPhoto, schedule,
    inheritsBusinessHours: document.querySelector("#staff-inherit-hours").checked,
    blocks: staffDraftBlocks.map((block) => ({ ...block }))
  };
  const oldStaff = state.staff;
  state.staff = previous
    ? state.staff.map((item) => item.id === id ? member : item)
    : [...state.staff, member];
  if (!saveState()) {
    state.staff = oldStaff;
    return;
  }
  render();
  resetStaffForm();
  showToast(previous ? "Profissional atualizado." : "Profissional adicionado à equipe.");
}

function toggleStaffMember(id) {
  const member = state.staff.find((item) => item.id === id);
  if (!member) return;
  const previous = member.active;
  member.active = !member.active;
  if (!saveState()) {
    member.active = previous;
    return;
  }
  render();
  showToast(member.active ? `${member.name} está ativo e disponível para novos agendamentos.` : `${member.name} foi desativado; o histórico foi preservado.`);
}

async function loadStaffPhoto(file) {
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    document.querySelector("#staff-photo-input").value = "";
    return showToast("Escolha uma imagem PNG, JPG ou WebP de até 8 MB.");
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem no navegador.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    staffDraftPhoto = canvas.toDataURL("image/webp", 0.78);
    if (staffDraftPhoto.length > 300_000) throw new Error("A imagem continua muito grande após a redução.");
    const preview = document.querySelector("#staff-photo-preview");
    preview.src = staffDraftPhoto;
    preview.classList.remove("hidden");
    document.querySelector("#remove-staff-photo").classList.remove("hidden");
  } catch (error) {
    console.error("Não foi possível processar a foto do profissional.", error);
    document.querySelector("#staff-photo-input").value = "";
    showToast(error.message || "Não foi possível carregar esta imagem.");
  }
}

function openCommissionPayment(staffId) {
  const member = state.staff.find((item) => item.id === staffId);
  if (!member) return;
  const range = getDashboardRange(dashboardPeriod, document.querySelector("#team-period-start").value, document.querySelector("#team-period-end").value);
  const metrics = staffMetrics(member, range);
  if (metrics.pending <= 0) return showToast("Este profissional não possui comissões pendentes no período.");
  const paidIds = new Set(state.commissionPayments.filter((payment) => payment.staffId === member.id).flatMap((payment) => payment.lines.map((line) => line.appointmentId)));
  const lines = metrics.completed.filter((item) => staffCommissionAmount(item) > 0 && !paidIds.has(item.id));
  if (!lines.length) return showToast("Não há atendimentos com comissão pendente para registrar.");
  document.querySelector("#commission-payment-staff-id").value = member.id;
  document.querySelector("#commission-payment-summary").textContent = `${member.name} · ${currency(metrics.pending)} pendente · ${lines.length} atendimento(s) concluído(s) entre ${range.label}.`;
  document.querySelector("#commission-payment-date").value = toDateInputValue(new Date());
  document.querySelector("#commission-payment-notes").value = "";
  elements.commissionPaymentDialog.showModal();
}

function saveCommissionPayment(event) {
  event.preventDefault();
  const staffId = document.querySelector("#commission-payment-staff-id").value;
  const paidAt = document.querySelector("#commission-payment-date").value;
  const notes = document.querySelector("#commission-payment-notes").value.trim();
  const member = state.staff.find((item) => item.id === staffId);
  if (!member || !paidAt || paidAt > toDateInputValue(new Date())) return showToast("Selecione um profissional e uma data de pagamento válida, não futura.");
  const range = getDashboardRange(dashboardPeriod, document.querySelector("#team-period-start").value, document.querySelector("#team-period-end").value);
  const paidIds = new Set(state.commissionPayments.filter((payment) => payment.staffId === member.id).flatMap((payment) => payment.lines.map((line) => line.appointmentId)));
  const lines = staffMetrics(member, range).completed.filter((item) => staffCommissionAmount(item) > 0 && !paidIds.has(item.id))
    .map((item) => ({ appointmentId: item.id, amount: staffCommissionAmount(item) }));
  if (!lines.length) return showToast("Não há comissões pendentes para este profissional no período.");
  const payment = { id: crypto.randomUUID(), staffId, paidAt, periodStart: range.startKey, periodEnd: range.endKey, notes, lines };
  state.commissionPayments.push(payment);
  recordActivity("commission-paid", `Comissão de ${member.name} registrada como paga: ${currency(lines.reduce((sum, line) => sum + line.amount, 0))}.`);
  if (!saveState()) {
    state.commissionPayments.pop();
    state.activity.pop();
    return;
  }
  elements.commissionPaymentDialog.close();
  render();
  navigate("team");
  showToast("Pagamento de comissão registrado neste navegador.");
}

function exportTeamCsv() {
  const range = getDashboardRange(dashboardPeriod, document.querySelector("#team-period-start").value, document.querySelector("#team-period-end").value);
  const completed = state.appointments.filter((item) => item.status === "completed" && item.date >= range.startKey && item.date <= range.endKey);
  if (!completed.length) return showToast("Não há serviços concluídos neste período para exportar.");
  const columns = ["Data", "Horário", "Funcionário", "Serviço", "Valor vendido (R$)", "Regra de comissão", "Comissão gerada (R$)", "Status da comissão"];
  const rows = completed.map((item) => {
    const member = state.staff.find((person) => person.id === item.staffId);
    const paid = state.commissionPayments.some((payment) => payment.staffId === item.staffId && payment.lines.some((line) => line.appointmentId === item.id));
    const commission = staffCommissionAmount(item);
    const commissionStatus = paid ? "Paga" : commission > 0 ? "Pendente" : "Não calculada";
    const commissionRule = item.commissionType === "fixed"
      ? `${currency(item.commissionValue || 0)} fixa`
      : Number.isFinite(item.commissionRate) ? `${item.commissionRate}%` : "";
    return [item.date, item.time, member?.name || "Sem profissional associado", item.serviceName || serviceForAppointment(item)?.name || "Serviço", item.price.toFixed(2).replace(".", ","), commissionRule, commission.toFixed(2).replace(".", ","), commissionStatus];
  });
  const csv = `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `efahub-equipe-${range.startKey}-${range.endKey}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${completed.length} atendimento(s) concluído(s) exportado(s) em CSV.`);
}

function printTeamReport() {
  navigate("team");
  document.body.classList.add("print-team-report");
  const cleanup = () => document.body.classList.remove("print-team-report");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => {
    window.print();
    window.setTimeout(cleanup, 1000);
  }, 50);
}

function setSelectedDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  state.selectedDate = value;
  elements.agendaDate.value = value;
  renderAgenda();
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) return navigate(viewButton.dataset.view);

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const { action, id } = actionButton.dataset;
  if (action === "open-command") return openCommandPalette("cliente");
  if (action === "optimize-agenda") {
    state.selectedDate = toDateInputValue(new Date());
    render();
    navigate("agenda");
    return;
  }
  if (action === "new-appointment") return openAppointmentDialog();
  if (action === "edit-appointment") {
    const appointment = state.appointments.find((item) => item.id === id && item.status === "scheduled");
    if (!appointment) return showToast("Este agendamento não está mais disponível para alteração.");
    return openAppointmentDialog({
      appointmentId: appointment.id,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      serviceId: appointment.serviceId,
      staffId: appointment.staffId,
      date: appointment.date,
      time: appointment.time,
      notes: appointment.notes
    });
  }
  if (action === "select-suggestion") {
    const timeSelect = document.querySelector("#appointment-time");
    if ([...timeSelect.options].some((option) => option.value === actionButton.dataset.time)) {
      timeSelect.value = actionButton.dataset.time;
    }
    return;
  }
  if (action === "new-service") return openServiceDialog();
  if (action === "public-booking") {
    if (!state.onlineBookingEnabled) return showToast("O agendamento online está desativado nas configurações.");
    return openAppointmentDialog();
  }
  if (action === "toggle-kpi") {
    const expanded = actionButton.getAttribute("aria-expanded") !== "true";
    actionButton.setAttribute("aria-expanded", String(expanded));
    actionButton.closest(".kpi-card").querySelector(".kpi-detail").classList.toggle("hidden", !expanded);
  }
  if (action === "complete") updateAppointmentStatus(id, "completed");
  if (action === "cancel") updateAppointmentStatus(id, "cancelled");
  if (action === "whatsapp") openWhatsApp(id);
  if (action === "edit-service") openServiceDialog(state.services.find((item) => item.id === id));
  if (action === "delete-service") removeService(id);
  if (action === "edit-product") editProduct(id);
  if (action === "delete-product") removeProduct(id);
  if (action === "stock-in") adjustProductStock(id, "in");
  if (action === "stock-out") adjustProductStock(id, "out");
  if (action === "refund-sale") refundProductSale(id);
  if (action === "book-waitlist") openWaitlistBooking(id);
  if (action === "remove-waitlist") removeWaitlistEntry(id);
  if (action === "edit-staff") editStaffMember(id);
  if (action === "toggle-staff") toggleStaffMember(id);
  if (action === "pay-commission") openCommissionPayment(id);
  if (action === "remove-staff-block") {
    staffDraftBlocks = staffDraftBlocks.filter((block) => block.id !== id);
    renderStaffBlocks();
  }
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelector("#command-trigger").addEventListener("click", () => openCommandPalette());
document.querySelector("#theme-toggle").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
document.querySelectorAll("[data-theme-choice]").forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
});
document.querySelector("#sidebar-toggle").addEventListener("click", (event) => {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  event.currentTarget.setAttribute("aria-label", collapsed ? "Expandir menu lateral" : "Recolher menu lateral");
  event.currentTarget.title = collapsed ? "Expandir menu lateral" : "Recolher menu lateral";
});
document.querySelector("#command-search").addEventListener("input", (event) => renderCommandResults(event.target.value));
document.querySelector("#command-results").addEventListener("click", (event) => {
  const button = event.target.closest("[data-command-index]");
  if (button) runCommand(Number(button.dataset.commandIndex));
});
document.querySelector("#command-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const active = document.querySelector("#command-results .command-result.active") || document.querySelector("#command-results [data-command-index]");
    if (active) runCommand(Number(active.dataset.commandIndex));
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const results = [...document.querySelectorAll("#command-results [data-command-index]")];
    if (!results.length) return;
    const delta = event.key === "ArrowDown" ? 1 : -1;
    commandActiveIndex = (commandActiveIndex + delta + results.length) % results.length;
    results.forEach((result, index) => result.classList.toggle("active", index === commandActiveIndex));
    results[commandActiveIndex].scrollIntoView({ block: "nearest" });
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
  }
});
document.querySelector("#assistant-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const question = document.querySelector("#assistant-question").value;
  const response = document.querySelector("#assistant-response");
  response.textContent = respondToAssistant(question);
  response.classList.remove("hidden");
});
document.querySelector(".assistant-prompts").addEventListener("click", (event) => {
  const button = event.target.closest("[data-prompt]");
  if (!button) return;
  document.querySelector("#assistant-question").value = button.dataset.prompt;
  document.querySelector("#assistant-form").requestSubmit();
});
elements.appointmentForm.addEventListener("submit", saveAppointment);
elements.serviceForm.addEventListener("submit", saveService);
elements.commissionPaymentForm.addEventListener("submit", saveCommissionPayment);
document.querySelector("#product-form").addEventListener("submit", saveProduct);
document.querySelector("#product-sale-form").addEventListener("submit", registerProductSale);
document.querySelector("#waitlist-form").addEventListener("submit", addWaitlistEntry);
document.querySelector("#support-form").addEventListener("submit", createSupportTicket);
document.querySelector("#add-service").addEventListener("click", () => openServiceDialog());
document.querySelector("#settings-form").addEventListener("submit", saveSettings);
document.querySelector("#cancel-product-edit").addEventListener("click", resetProductForm);
document.querySelector("#sale-product").addEventListener("change", updateSaleTotal);
document.querySelector("#sale-quantity").addEventListener("input", updateSaleTotal);
document.querySelector("#export-sales-csv").addEventListener("click", exportSalesCsv);
document.querySelector("#appointment-recurring").addEventListener("change", (event) => {
  document.querySelector("#recurrence-options").classList.toggle("hidden", !event.currentTarget.checked);
});
document.querySelector("#staff-form").addEventListener("submit", saveStaffMember);
document.querySelector("#staff-commission-type-input").addEventListener("change", updateCommissionInput);
document.querySelector("#team-add-staff").addEventListener("click", () => {
  navigate("team");
  resetStaffForm();
  document.querySelector("#staff-form").scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#staff-name-input").focus({ preventScroll: true });
});
document.querySelector("#add-staff-block").addEventListener("click", addStaffBlock);
document.querySelector("#staff-inherit-hours").addEventListener("change", updateStaffScheduleDisabled);
document.querySelector("#staff-weekly-schedule").addEventListener("change", (event) => {
  const toggle = event.target.closest("[data-staff-day-open]");
  if (toggle) updateStaffScheduleDisabled();
});
document.querySelector("#staff-photo-input").addEventListener("change", (event) => loadStaffPhoto(event.target.files[0]));
document.querySelector("#remove-staff-photo").addEventListener("click", () => {
  staffDraftPhoto = "";
  document.querySelector("#staff-photo-preview").classList.add("hidden");
  document.querySelector("#staff-photo-input").value = "";
  document.querySelector("#remove-staff-photo").classList.add("hidden");
});
document.querySelector("#cancel-staff-edit").addEventListener("click", resetStaffForm);
document.querySelector("#service-select").addEventListener("change", () => {
  renderAppointmentStaffOptions(document.querySelector("#appointment-staff").value);
});
document.querySelector("#appointment-staff").addEventListener("change", refreshAvailableSlots);
document.querySelector("#appointment-date").addEventListener("change", refreshAvailableSlots);
document.querySelector("#export-report").addEventListener("click", exportDashboardReport);
document.querySelector("#export-team-csv").addEventListener("click", exportTeamCsv);
document.querySelector("#export-team-pdf").addEventListener("click", printTeamReport);
document.querySelector("#team-sort").addEventListener("change", (event) => {
  teamSort = event.currentTarget.value;
  renderTeam();
});
document.querySelector("#refresh-dashboard").addEventListener("click", () => {
  render();
  showToast("Dashboard atualizado com os dados salvos.");
});
document.querySelectorAll(".period-tabs").forEach((tabs) => tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-period], [data-team-period]");
  if (!button) return;
  dashboardPeriod = button.dataset.period || button.dataset.teamPeriod;
  document.querySelector("#period-start").value = document.querySelector("#team-period-start").value;
  document.querySelector("#period-end").value = document.querySelector("#team-period-end").value;
  renderOverview();
  renderTeam();
}));
function updateCustomRange(event) {
  const sourceIsTeam = event.currentTarget.id.startsWith("team-");
  const sourceStart = document.querySelector(sourceIsTeam ? "#team-period-start" : "#period-start");
  const sourceEnd = document.querySelector(sourceIsTeam ? "#team-period-end" : "#period-end");
  if (sourceIsTeam) {
    document.querySelector("#period-start").value = sourceStart.value;
    document.querySelector("#period-end").value = sourceEnd.value;
  } else {
    document.querySelector("#team-period-start").value = sourceStart.value;
    document.querySelector("#team-period-end").value = sourceEnd.value;
  }
  if (dashboardPeriod !== "custom" || !sourceStart.value || !sourceEnd.value) return;
  const start = sourceStart.value;
  const end = sourceEnd.value;
  if (start > end) {
    showToast("A data inicial precisa ser anterior ou igual à data final.");
    return;
  }
  renderOverview();
  renderTeam();
}
document.querySelector("#period-start").addEventListener("change", updateCustomRange);
document.querySelector("#period-end").addEventListener("change", updateCustomRange);
document.querySelector("#team-period-start").addEventListener("change", updateCustomRange);
document.querySelector("#team-period-end").addEventListener("change", updateCustomRange);
document.querySelector("#shop-logo-input").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) saveShopLogo(file);
});
document.querySelector("#remove-shop-logo").addEventListener("click", removeShopLogo);
document.querySelector("#business-hours-list").addEventListener("change", (event) => {
  const toggle = event.target.closest("[data-day-open]");
  if (!toggle) return;
  const day = toggle.dataset.dayOpen;
  document.querySelector(`[data-day-start="${day}"]`).disabled = !toggle.checked;
  document.querySelector(`[data-day-end="${day}"]`).disabled = !toggle.checked;
});
document.querySelector("#today-button").addEventListener("click", () => {
  state.selectedDate = toDateInputValue(new Date());
  render();
  navigate("agenda");
});
document.querySelector("#agenda-today").addEventListener("click", () => setSelectedDate(toDateInputValue(new Date())));
document.querySelector("#previous-day").addEventListener("click", () => {
  const date = parseDate(state.selectedDate);
  date.setDate(date.getDate() - 1);
  setSelectedDate(toDateInputValue(date));
});
document.querySelector("#next-day").addEventListener("click", () => {
  const date = parseDate(state.selectedDate);
  date.setDate(date.getDate() + 1);
  setSelectedDate(toDateInputValue(date));
});
elements.agendaDate.addEventListener("change", (event) => setSelectedDate(event.target.value));
document.querySelector("#clear-data").addEventListener("click", restoreDemoData);
document.querySelector("#settings-clear-data").addEventListener("click", restoreDemoData);

const initialToday = new Date();
document.querySelector("#waitlist-date").min = toDateInputValue(initialToday);
document.querySelector("#period-start").value = toDateInputValue(new Date(initialToday.getFullYear(), initialToday.getMonth(), 1));
document.querySelector("#period-end").value = toDateInputValue(initialToday);
document.querySelector("#team-period-start").value = document.querySelector("#period-start").value;
document.querySelector("#team-period-end").value = document.querySelector("#period-end").value;
applyTheme(getSavedTheme());
loadState();
resetStaffForm();
render();
document.querySelectorAll('input[type="tel"]').forEach((input) => {
  const validate = () => {
    const value = input.value.trim();
    input.setCustomValidity(value && !EFAHubUtils.isValidBrazilianMobile(value)
      ? "Informe um celular com DDD e 9 dígitos, como (41) 99999-9999."
      : "");
  };
  input.addEventListener("input", () => {
    input.value = EFAHubUtils.formatBrazilianMobile(input.value);
    validate();
    if (input.id === "customer-phone") refreshAvailableSlots();
  });
  input.addEventListener("blur", validate);
  if (input.value) input.value = EFAHubUtils.formatBrazilianMobile(input.value);
});
