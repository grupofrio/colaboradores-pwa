import { shouldShowStagingBanner } from '../lib/stagingRuntime'

export default function StagingEnvironmentBanner() {
  if (!shouldShowStagingBanner()) return null
  return (
    <div
      role="status"
      data-testid="staging-environment-banner"
      className="sticky top-0 z-[120] flex min-h-11 items-center justify-center border-b border-amber-500 bg-amber-400 px-4 py-2 text-center text-sm font-black tracking-widest text-black"
    >
      STAGING
    </div>
  )
}
