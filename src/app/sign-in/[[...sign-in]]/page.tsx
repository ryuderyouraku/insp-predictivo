import Image from 'next/image'
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <Image
        src="/images/login-bg.jpg"
        alt="Inspector realizando termografía a una polea de faja transportadora"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/30 md:bg-none" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center gap-10 px-6 py-12 md:flex-row md:items-center md:justify-between md:gap-8 md:px-12 lg:px-16">
        <div className="max-w-lg animate-fade-in-up text-white">
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            Termografía a chumaceras de fajas transportadoras
          </h1>
          <p className="mt-4 text-slate-300">
            Registra, analiza y reporta la condición térmica de chumaceras en fajas
            transportadoras, con historial completo por equipo y visibilidad para cada cliente y
            contratista.
          </p>
        </div>

        <div className="w-full animate-fade-in-up [animation-delay:100ms] [animation-fill-mode:both] md:w-auto md:shrink-0">
          <SignIn
            appearance={{
              elements: {
                rootBox: 'w-full sm:max-w-sm md:w-96',
                card: 'w-full rounded-2xl border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/50 backdrop-blur-md',
              },
            }}
          />
        </div>
      </div>
    </main>
  )
}
