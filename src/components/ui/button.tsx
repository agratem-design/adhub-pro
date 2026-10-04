import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// أزرار موحّدة: زوايا ثابتة، ارتفاع مريح للمس، بدون تكبير عند التحويم، ضغطة خفيفة عند النقر
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold select-none cursor-pointer ring-offset-background transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-border/70 bg-card text-foreground hover:bg-muted hover:border-border",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground/90 hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        luxury: "bg-gradient-luxury text-white shadow-sm hover:opacity-90",
        hero: "bg-primary text-primary-foreground font-bold shadow-sm hover:bg-primary/90",
      },
      size: {
        default: "h-9 sm:h-10 px-3.5 sm:px-4 text-xs sm:text-sm",
        sm: "h-8 sm:h-9 px-3 text-xs",
        lg: "h-10 sm:h-11 px-5 sm:px-6 text-sm sm:text-base",
        icon: "h-9 w-9 sm:h-10 sm:w-10",
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
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...(!asChild ? { type } : {})} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
