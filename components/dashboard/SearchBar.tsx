'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

export default function SearchBar() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="relative mb-4">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />
      <input
        type="text"
        placeholder="Search Influencer"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 rounded-lg focus:ring-2 focus:ring-[#EC67A1] focus:border-transparent text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400"
      />
    </div>
  );
}