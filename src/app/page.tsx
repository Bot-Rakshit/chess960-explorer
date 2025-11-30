"use client";

import Link from "next/link";
import HeroInteractive from "@/components/HeroInteractive";
import { Cpu } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="h-screen bg-background text-creme flex flex-col relative overflow-hidden selection:bg-creme selection:text-background font-sans">
      {/* Ambient Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-creme/5 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-40" />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4 glass px-4 sm:px-6 py-2 sm:py-3 rounded-full border border-creme/10">
          <div className="w-6 h-6 sm:w-7 sm:h-7 bg-creme rounded-[3px] flex items-center justify-center shadow-[0_0_15px_rgba(240,230,210,0.4)]">
            <span className="text-background font-bold text-[10px] sm:text-[12px]">960</span>
          </div>
          <span className="font-bold tracking-widest text-xs sm:text-sm opacity-90">EXPLORER</span>
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/about" className="text-xs sm:text-sm font-medium text-creme-muted hover:text-creme transition-colors tracking-wide uppercase">
                About
            </Link>
        </div>
      </header>

      {/* Main Hero */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-4 sm:px-6 pb-0 pt-16 sm:pt-0">
        <div className="max-w-[1400px] w-full grid lg:grid-cols-12 gap-0 items-center h-full">

          {/* Text Content */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-6 sm:space-y-8 text-center lg:text-left relative z-20 order-2 lg:order-1 px-2 sm:pl-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl xl:text-8xl font-black tracking-tighter leading-[0.85] text-white mix-blend-difference">
                FREESTYLE
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-creme to-accent">CHESS</span>
              </h1>

              <div className="h-px w-16 sm:w-24 bg-white/10 my-4 sm:my-6 mx-auto lg:mx-0" />

              <p className="text-base sm:text-xl text-creme-muted max-w-md mx-auto lg:mx-0 font-light leading-relaxed">
                The ultimate 960 Explorer. <br className="hidden sm:block" />
                <span className="text-creme">Discover, Analyze, and Master every starting position.</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-center lg:justify-start pt-2 sm:pt-4">
              <Link
                href="/explore"
                className="group relative px-8 sm:px-10 py-4 sm:py-5 bg-creme text-background font-bold text-lg sm:text-xl tracking-widest uppercase hover:bg-white transition-all hover:scale-105"
              >
                Initialize
                <div className="absolute inset-0 border border-white/20 scale-105 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
              </Link>
            </div>
          </div>

          {/* Visual / Reactor Core */}
          <div className="lg:col-span-7 relative flex justify-center items-center order-1 lg:order-2 h-[40vh] sm:h-[50vh] lg:h-full">
            <HeroInteractive />
          </div>

        </div>
      </main>

      {/* Footer Stats */}
      <footer className="absolute bottom-0 w-full z-10 border-t border-white/5 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-6">
          <div className="flex justify-between items-center">
            {[
              { label: "POSITIONS", value: "960" },
              { label: "DATABASE", value: "5.4K+" },
              { label: "ENGINE", value: "SF 17" },
            ].map((stat, i) => (
              <div key={i} className="text-center group cursor-default flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
                <div className="text-sm sm:text-xl font-bold text-creme group-hover:text-stockfish transition-colors duration-300">{stat.value}</div>
                <div className="hidden sm:block h-4 w-px bg-white/10" />
                <div className="text-[8px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-creme-muted group-hover:text-creme transition-colors">{stat.label}</div>
              </div>
            ))}
             <div className="text-[8px] sm:text-[10px] text-creme-muted/50 tracking-widest uppercase hidden sm:block">
                Depth 40
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
