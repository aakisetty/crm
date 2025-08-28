"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef(({ className, children, native = false, ...props }, ref) => {
  if (native) {
    // Use native scrolling to avoid overlay scrollbars covering content
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-full w-full overflow-y-auto overflow-x-visible pr-4 md:pr-6 [scrollbar-gutter:stable_both-edges]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden [scrollbar-gutter:stable_both-edges]", className)}
      {...props}>
      {/* Add a small right padding so overlay scrollbars don't cover content */}
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] pr-4 md:pr-6 [scrollbar-gutter:stable_both-edges]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
})
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}>
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
