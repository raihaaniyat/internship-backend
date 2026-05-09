import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  size,
  className,
  priority = false,
}: {
  /** Pixel width/height (square). */
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="BuyAnyAutoPart"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      priority={priority}
    />
  );
}
