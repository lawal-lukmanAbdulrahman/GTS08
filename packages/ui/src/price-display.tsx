import { formatKobo } from "@gts/utils/money";

interface PriceDisplayProps {
  amountInKobo: number;
  className?: string;
}

export function PriceDisplay({ amountInKobo, className }: PriceDisplayProps) {
  return <span className={`font-mono ${className ?? ""}`}>{formatKobo(amountInKobo)}</span>;
}
