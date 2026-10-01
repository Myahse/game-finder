import { Link } from 'react-router-dom'

export function WelcomePage() {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#0b0e12] text-[#f3f1ec]">
      {/* Court lines */}
      <svg className="pointer-events-none absolute -right-32 -top-24 h-[640px] w-[640px] text-brand/25" viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
        <circle cx="200" cy="200" r="190" />
        <circle cx="200" cy="200" r="60" />
        <path d="M10 200h380M200 10v380" />
        <path d="M60 60c60 60 60 220 0 280M340 60c-60 60-60 220 0 280" />
      </svg>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-end px-6 pb-10 pt-24">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#9aa3ae]">
          <span className="relative inline-flex size-2.5 text-[#22c55e]">
            <span className="pulse relative size-2.5 rounded-full bg-current" />
          </span>
          Games happening near you right now
        </div>
        <h1 className="display text-7xl font-extrabold sm:text-8xl">
          Find the
          <br />
          <span className="text-brand">Game</span>
        </h1>
        <p className="mt-5 text-xl text-[#c9ced6]">
          Don't search for a court.
          <br />
          <b className="text-white">Find the game.</b>
        </p>

        <div className="mt-10 grid gap-3">
          <Link to="/register" className="display flex min-h-14 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-white">
            Create account
          </Link>
          <Link to="/login" className="display flex min-h-14 items-center justify-center rounded-2xl border border-white/20 text-2xl font-bold">
            Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
