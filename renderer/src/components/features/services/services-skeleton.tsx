import { cn } from "@/lib/utils"

export function ServicesSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
      <header className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
          <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="col-span-4 grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "col-span-1 bg-white dark:bg-[#1C2333] rounded-2xl p-6 border border-gray-100 dark:border-gray-800/50",
                "animate-pulse [animation-delay:100ms]"
              )}
            >
              <div className="space-y-4">
                <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                <div className="h-8 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-gray-100 dark:bg-gray-800 rounded-full" />
                  <div className="h-4 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="col-span-2 bg-white dark:bg-[#1C2333] rounded-2xl p-8 border border-gray-100 dark:border-gray-800/50 animate-pulse [animation-delay:300ms]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
              <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="h-14 w-full sm:w-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />
              <div className="h-14 w-full sm:w-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="col-span-2 bg-white dark:bg-[#1C2333] rounded-2xl p-8 border border-gray-100 dark:border-gray-800/50 animate-pulse [animation-delay:400ms]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
              <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-14 w-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />
              <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            </div>
          </div>
        </div>

        <div className="col-span-4 bg-white dark:bg-[#1C2333] rounded-2xl p-8 border border-gray-100 dark:border-gray-800/50 animate-pulse [animation-delay:500ms]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg" />
              <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            </div>
            <div className="grid gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 