import clsx from "clsx";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ variant = "primary", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      {...props}
      className={clsx(
        "font-meta text-xs uppercase tracking-wide px-4 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-carbon text-ivory hover:bg-cobalt",
        variant === "secondary" && "border border-carbon text-carbon hover:bg-carbon hover:text-ivory",
        variant === "ghost" && "text-graphite hover:text-carbon",
        className,
      )}
    />
  );
});
