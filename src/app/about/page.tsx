"use client";

import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-creme flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full space-y-12 text-center">
          
          {/* App Info */}
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white mix-blend-difference">
              FREESTYLE
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-creme to-accent">EXPLORER</span>
            </h1>
            <p className="text-xl text-creme-muted leading-relaxed">
              An advanced tool designed for the modern chess enthusiast. Explore all 960 starting positions, analyze with Stockfish 17.1, and discover new strategic landscapes in the world of Freestyle Chess.
            </p>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Developer Info */}
          <div className="space-y-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <p className="text-sm uppercase tracking-[0.2em] text-creme-muted/70">
              Developed By
            </p>
            
            <Link 
              href="https://chessiro.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-accent/30 transition-all duration-300"
            >
              <div className="relative w-48 h-16 transition-transform duration-300 group-hover:scale-105">
                <Image 
                  src="/chessiro.svg" 
                  alt="Chessiro Logo" 
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex items-center gap-2 text-creme-muted group-hover:text-accent transition-colors">
                <span className="text-sm tracking-widest uppercase font-medium">Visit Chessiro.com</span>
              </div>
            </Link>
          </div>

          <div className="pt-12 text-[10px] text-creme-muted/30 tracking-widest uppercase">
            Version 1.0.0 • Freestyle Core
          </div>
        </div>
      </main>
    </div>
  );
}
