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
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-8 flex justify-center"><span className="brand-lockup text-2xl font-extrabold tracking-tight text-[#171916]"><span className="grid size-10 place-items-center rounded-xl bg-[#7a2438] text-white">E</span><span>EFA<span className="font-medium text-[#7a2438]">Hub</span></span></span></div>
        <p className="text-sm font-bold tracking-[.16em] text-[#7a2438]">EFaHUB · DEMONSTRAÇÃO</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Escolha uma área para testar</h1>
        <p className="mt-3 text-muted">Protótipo com dados fictícios. As operações ainda não são persistidas.</p>
        <nav className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Áreas demonstrativas">
          {areas.map((area) => (
            <Link key={area.href} href={area.href} className="rounded-2xl border border-[#e2e8f0] bg-white p-5 text-left text-inherit no-underline shadow-sm transition hover:border-[#7a2438] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a2438]">
              <strong className="block">{area.label}</strong>
              <span className="mt-2 block text-sm text-muted">{area.detail}</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
