export type Role = "client" | "professional" | "employee" | "businessAdmin" | "platformAdmin";
export type AppointmentStatus = "Confirmado" | "Aguardando" | "Concluído";

export type Appointment = {
  id: number;
  customer: string;
  service: string;
  professional: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  price: number;
};

export type Booking = {
  customer: string;
  business: string;
  service: string;
  professional: string;
  date: string;
  time: string;
  price: number;
};

export const businesses = [
  { id: "atelier", name: "Ateliê Aurora", category: "Salão de beleza", rating: "4,9", distance: "1,2 km", image: "AA", location: "Jardins, São Paulo" },
  { id: "barber", name: "Barbearia Central", category: "Barbearia", rating: "4,8", distance: "2,4 km", image: "BC", location: "Pinheiros, São Paulo" },
  { id: "skin", name: "Casa Serena", category: "Estética e bem-estar", rating: "5,0", distance: "3,1 km", image: "CS", location: "Vila Madalena, São Paulo" }
];

export const services = [
  { id: "cut", name: "Corte personalizado", duration: "45 min", price: 85 },
  { id: "color", name: "Coloração", duration: "90 min", price: 180 },
  { id: "beard", name: "Corte + barba", duration: "60 min", price: 95 },
  { id: "skin", name: "Limpeza de pele", duration: "60 min", price: 160 }
];

export const professionals = [
  { id: "marina", name: "Marina Costa", role: "Especialista em corte", rating: "4,9", years: "8 anos" },
  { id: "rafael", name: "Rafael Martins", role: "Colorista", rating: "5,0", years: "6 anos" },
  { id: "camila", name: "Camila Rocha", role: "Esteticista", rating: "4,9", years: "10 anos" }
];

export function makeInitialAppointments(): Appointment[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const inTwoDays = new Date(today);
  inTwoDays.setDate(today.getDate() + 2);
  const date = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

  return [
    { id: 1, customer: "João Almeida", service: "Corte personalizado", professional: "Marina Costa", date: date(today), time: "09:00", status: "Confirmado", price: 85 },
    { id: 2, customer: "Beatriz Souza", service: "Coloração", professional: "Rafael Martins", date: date(today), time: "10:30", status: "Aguardando", price: 180 },
    { id: 3, customer: "Lucas Ferreira", service: "Corte + barba", professional: "Marina Costa", date: date(today), time: "14:00", status: "Confirmado", price: 95 },
    { id: 4, customer: "Ana Clara Lima", service: "Limpeza de pele", professional: "Camila Rocha", date: date(tomorrow), time: "11:00", status: "Confirmado", price: 160 },
    { id: 5, customer: "Pedro Nunes", service: "Corte personalizado", professional: "Rafael Martins", date: date(inTwoDays), time: "15:30", status: "Confirmado", price: 85 }
  ];
}

export const roleOptions: { id: Role; label: string }[] = [
  { id: "client", label: "Cliente" },
  { id: "professional", label: "Profissional" },
  { id: "employee", label: "Funcionário" },
  { id: "businessAdmin", label: "Administrador da empresa" },
  { id: "platformAdmin", label: "Administrador EFAHub" }
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${dateValue}T12:00:00`));
}
