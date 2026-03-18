"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-all"
        style={{
          transform: `translateX(-${100 - (value || 0)}%)`,
          backgroundImage:
            "linear-gradient(" +
            "135deg," +
            "var(--color-primary) 25%," +
            "color-mix(in srgb, var(--color-primary) 60%, transparent) 25%," +
            "color-mix(in srgb, var(--color-primary) 60%, transparent) 50%," +
            "var(--color-primary) 50%," +
            "var(--color-primary) 75%," +
            "color-mix(in srgb, var(--color-primary) 60%, transparent) 75%," +
            "color-mix(in srgb, var(--color-primary) 60%, transparent) 100%" +
            ")",
          backgroundSize: "1rem 1rem",
          animation: "progress-stripes 0.6s linear infinite",
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
