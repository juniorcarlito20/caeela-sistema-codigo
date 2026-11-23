import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { paginaInicial } from "@/domain/acesso";

export default async function PaginaInicial() {
  const sessao = await auth();
  if (sessao?.user) {
    redirect(paginaInicial(sessao.user.perfil));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        Centro de Atendimento Educacional Especializado de Licínio de Almeida – BA
      </p>
      <h1 className="text-4xl font-black tracking-widest text-[#0070F0]">
        CAEELA
      </h1>
      <p className="text-xs tracking-[3px] text-slate-500">
        ACOLHER, INCLUIR E EDUCAR
      </p>
      <p className="max-w-xl text-sm leading-relaxed text-slate-600">
        Sistema de gestão do centro: agenda, presença com assinatura,
        prontuário, relatórios em PDF timbrado e lembretes por WhatsApp.
      </p>
      <a
        href="/entrar"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#0A63C9] px-6 py-3 text-sm font-bold text-white"
      >
        Entrar
      </a>
    </main>
  );
}
