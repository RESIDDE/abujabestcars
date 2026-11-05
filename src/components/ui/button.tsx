import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-xs font-bold ring-offset-background transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#d4ff32] text-black font-extrabold hover:brightness-105 shadow-md shadow-[#d4ff32]/25",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20",
        outline: "border border-border bg-white text-foreground hover:bg-muted dark:bg-[#212328] dark:border-[#2e3138] dark:hover:bg-[#282a32] dark:hover:border-[#3e424c]",
        secondary: "bg-muted text-foreground hover:bg-muted/80 border border-border dark:bg-[#292b32] dark:text-foreground dark:hover:bg-[#32353e] dark:border-[#353842]",
        ghost: "hover:bg-muted text-muted-foreground hover:text-foreground dark:hover:bg-[#24262c] dark:text-[#8e919f] dark:hover:text-white",
        link: "text-[#73a800] dark:text-[#d4ff32] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-4 text-xs font-semibold",
        lg: "h-12 px-7 text-sm font-extrabold",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
