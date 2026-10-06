'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function PublicNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo — goes to Home */}
        <Link 
          href="/" 
          className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent"
        >
          VidForge AI
        </Link>

        {/* 3-Line Menu Button + Dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-zinc-300 hover:text-white p-2"
            aria-label="Menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
              <Link
                href="/signup"
                className="block px-5 py-3 hover:bg-zinc-800 text-zinc-200"
                onClick={() => setMenuOpen(false)}
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                className="block px-5 py-3 hover:bg-zinc-800 text-zinc-200 border-t border-zinc-800"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}