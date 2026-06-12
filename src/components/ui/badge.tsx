import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "bg-blue-600 text-white hover:bg-blue-700",
                secondary:
                    "bg-slate-100 text-slate-700 hover:bg-slate-200",
                destructive:
                    "bg-red-500 text-white hover:bg-red-600",
                outline:
                    "border border-gray-200 text-gray-700 bg-white",
                success:
                    "bg-green-100 text-green-700 hover:bg-green-200",
                warning:
                    "bg-amber-100 text-amber-700 hover:bg-amber-200",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
