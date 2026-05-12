/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AlabaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src="/alaba_icon.png" 
    alt="Alaba Icon" 
    className={cn("object-cover", className)}
    onError={(e) => {
      // Fallback if image is missing
      e.currentTarget.style.display = 'none';
    }}
  />
);


export function formatCurrency(amount: number | undefined | null, currency: string = 'USD'): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'NGN': '₦',
    'GBP': '£',
    'EUR': '€'
  };
  const symbol = symbols[currency] || '$';
  if (amount === undefined || amount === null) {
    return `${symbol}0.00`;
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
