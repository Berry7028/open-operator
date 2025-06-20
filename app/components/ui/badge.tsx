import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/app/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#00ADB5] text-[#222831]",
        secondary:
          "border-[#495057] bg-[#393E46] text-[#EEEEEE]",
        destructive:
          "border-transparent bg-[#ef4444] text-[#EEEEEE]",
        outline: "text-[#EEEEEE] border-[#495057]",
        success:
          "border-transparent bg-[#22c55e] text-[#EEEEEE]",
        warning:
          "border-transparent bg-[#eab308] text-[#222831]",
        minimal:
          "border-[#495057] bg-[#222831] text-[#CED4DA]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants } 