import Link from "next/link";

export default function Home() {
  const areas = [
    { href: "/cliente/inicio", label: "Cliente", detail: "Descubra empresas e agende serviços" },
    { href: "/profissional/inicio", label: "Profissional", detail: "Acompanhe agenda e atendimentos" },
    { href: "/funcionario/inicio", label: "Funcionário", detail: "Gerencie a operação da recepção" },
    { href: "/empresa/inicio", label: "Administrador da empresa", detail: "Acesse a gestão do negócio" },
    { href: "/plataforma/inicio", label: "Administrador EFAHub", detail: "Explore a visão da plataforma" }
  ];

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-16 text-[#171916]">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold tracking-[.16em] text-[#7853d6]">EFaHUB · DEMONSTRAÇÃO</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Escolha uma área para testar</h1>
        <p className="mt-3 text-muted">Protótipo com dados fictícios. As operações ainda não são persistidas.</p>
        <nav className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Áreas demonstrativas">
          {areas.map((area) => (
            <Link key={area.href} href={area.href} className="rounded-2xl border border-[#e2e8f0] bg-white p-5 text-inherit no-underline shadow-sm transition hover:border-[#7853d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7853d6]">
              <strong className="block">{area.label}</strong>
              <span className="mt-2 block text-sm text-muted">{area.detail}</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
