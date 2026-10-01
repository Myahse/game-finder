import type { ReactNode } from 'react'

const layoutClass = {
  /** Maresi properties map: docked sheet, auto height, horizontal card rail */
  dock:
    'z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.14)] pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-3 md:inset-x-4 md:bottom-4 md:max-w-2xl md:mx-auto md:rounded-3xl md:border',
  /** Court / detail panel: tall scrollable sheet */
  panel:
    'z-10 flex max-h-[78%] flex-col overflow-hidden shadow-[0_-12px_40px_rgba(0,0,0,0.18)] md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[400px] md:rounded-3xl md:border',
} as const

/**
 * Map overlay container — matches Maresi `AllPropertiesPage` list sheet on mobile
 * (`rounded-t-3xl border-t bg-card` + handle + horizontal cards).
 */
export function MapBottomSheet({
  children,
  ariaLabel,
  layout = 'dock',
  className = '',
}: {
  children: ReactNode
  ariaLabel: string
  layout?: keyof typeof layoutClass
  className?: string
}) {
  const isPanel = layout === 'panel'

  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      className={`absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface ${layoutClass[layout]} ${className}`}
    >
      <div className="flex justify-center pt-2" aria-hidden>
        <span className="h-1.5 w-10 rounded-full bg-line" />
      </div>
      {isPanel ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div> : children}
    </div>
  )
}
