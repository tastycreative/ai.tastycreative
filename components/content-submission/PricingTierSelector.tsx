'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PricingTierSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PricingTierSelector({ value, onChange }: PricingTierSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="pricingCategory" className="text-sm font-medium text-zinc-300">
        Pricing Tier <span className="text-brand-light-pink">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full px-4 py-3 border border-zinc-700/50 rounded-xl bg-zinc-800/50 text-white focus:ring-2 focus:ring-brand-light-pink focus:border-transparent transition-all">
          <SelectValue placeholder="Select pricing tier" />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-700">
          <SelectItem value="PORN_ACCURATE" className="text-white hover:bg-zinc-800">
            💎 Porn Accurate
          </SelectItem>
          <SelectItem value="PORN_SCAM" className="text-white hover:bg-zinc-800">
            🔴 Porn Scam
          </SelectItem>
          <SelectItem value="GF_ACCURATE" className="text-white hover:bg-zinc-800">
            💕 GF Accurate
          </SelectItem>
          <SelectItem value="GF_SCAM" className="text-white hover:bg-zinc-800">
            🟠 GF Scam
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-zinc-500 mt-1">
        Select the pricing tier for content categorization
      </p>
    </div>
  );
}
