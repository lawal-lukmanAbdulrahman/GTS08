/* The decorative illustrations behind the dashboard's four summary cards. Purely visual. */

export function BankWatermark() {
  return (
      <div className="absolute -right-5 -bottom-6 w-30 h-24 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
        <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <style>{`
              .wm-bank-g1-s1 { stop-color: #D1D5DB; }
              .wm-bank-g1-s2 { stop-color: #9CA3AF; }
              .wm-bank-g2-s1 { stop-color: #9CA3AF; }
              .wm-bank-g2-s2 { stop-color: #6B7280; }
              .wm-bank-stroke1 { stroke: rgba(0, 0, 0, 0.12); }
              .wm-bank-stroke2 { stroke: rgba(0, 0, 0, 0.10); }
              .dark .wm-bank-g1-s1 { stop-color: #303030; }
              .dark .wm-bank-g1-s2 { stop-color: #1A1A1A; }
              .dark .wm-bank-g2-s1 { stop-color: #3A3A3A; }
              .dark .wm-bank-g2-s2 { stop-color: #1E1E1E; }
              .dark .wm-bank-stroke1 { stroke: rgba(255, 255, 255, 0.18); }
              .dark .wm-bank-stroke2 { stroke: rgba(255, 255, 255, 0.14); }
            `}</style>
            <linearGradient id="bankFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.2" />
              <stop offset="50%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
    
            <mask id="fadeTopLeftBank">
              <rect x="0" y="0" width="120" height="100" fill="url(#bankFadeMask)" />
            </mask>
    
            <linearGradient id="bankGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-bank-g1-s1" />
              <stop offset="100%" className="wm-bank-g1-s2" />
            </linearGradient>
            <linearGradient id="bankPillarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" className="wm-bank-g2-s1" />
              <stop offset="100%" className="wm-bank-g2-s2" />
            </linearGradient>
          </defs>
    
          <g mask="url(#fadeTopLeftBank)" transform="rotate(-6 60 50)">
            {/* Triangular Bank Pediment Roof */}
            <path
              d="M 60 12 L 105 32 L 15 32 Z"
              fill="url(#bankGrad1)"
              className="wm-bank-stroke1"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
    
            {/* Frieze / Architrave beam */}
            <rect
              x="18"
              y="33"
              width="84"
              height="8"
              rx="2"
              fill="url(#bankGrad1)"
              className="wm-bank-stroke1"
              strokeWidth="1.4"
            />
    
            {/* 4 Bank Pillars/Columns */}
            <rect x="23" y="43" width="12" height="38" rx="3" fill="url(#bankPillarGrad)" className="wm-bank-stroke2" strokeWidth="1.2" />
            <rect x="43" y="43" width="12" height="38" rx="3" fill="url(#bankPillarGrad)" className="wm-bank-stroke2" strokeWidth="1.2" />
            <rect x="63" y="43" width="12" height="38" rx="3" fill="url(#bankPillarGrad)" className="wm-bank-stroke2" strokeWidth="1.2" />
            <rect x="83" y="43" width="12" height="38" rx="3" fill="url(#bankPillarGrad)" className="wm-bank-stroke2" strokeWidth="1.2" />
    
            {/* Base Steps Platform */}
            <rect x="12" y="82" width="96" height="7" rx="2" fill="url(#bankGrad1)" className="wm-bank-stroke1" strokeWidth="1.4" />
            <rect x="8" y="90" width="104" height="8" rx="2" fill="url(#bankGrad1)" className="wm-bank-stroke1" strokeWidth="1.4" />
          </g>
        </svg>
      </div>
  );
}

export function CashWatermark() {
  return (
      <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
        <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <style>{`
              .wm-cash-g1-s1 { stop-color: #D1D5DB; }
              .wm-cash-g1-s2 { stop-color: #9CA3AF; }
              .wm-cash-g2-s1 { stop-color: #CBD5E1; }
              .wm-cash-g2-s2 { stop-color: #64748B; }
              .wm-cash-g3-s1 { stop-color: #94A3B8; }
              .wm-cash-g3-s2 { stop-color: #475569; }
              .wm-cash-stroke1 { stroke: rgba(0, 0, 0, 0.12); }
              .wm-cash-stroke2 { stroke: rgba(0, 0, 0, 0.16); }
              .wm-cash-naira { fill: #334155; }
              .wm-cash-line { stroke: rgba(51, 65, 85, 0.6); }
              .dark .wm-cash-g1-s1 { stop-color: #303030; }
              .dark .wm-cash-g1-s2 { stop-color: #1B1B1B; }
              .dark .wm-cash-g2-s1 { stop-color: #252525; }
              .dark .wm-cash-g2-s2 { stop-color: #161616; }
              .dark .wm-cash-g3-s1 { stop-color: #1C1C1C; }
              .dark .wm-cash-g3-s2 { stop-color: #121212; }
              .dark .wm-cash-stroke1 { stroke: rgba(255, 255, 255, 0.14); }
              .dark .wm-cash-stroke2 { stroke: rgba(255, 255, 255, 0.18); }
              .dark .wm-cash-naira { fill: #FFFFFF; }
              .dark .wm-cash-line { stroke: rgba(255, 255, 255, 0.6); }
            `}</style>
            <linearGradient id="cashFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.2" />
              <stop offset="50%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
    
            <mask id="fadeTopLeftCash">
              <rect x="0" y="0" width="130" height="100" fill="url(#cashFadeMask)" />
            </mask>
    
            <linearGradient id="cashNoteGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-cash-g1-s1" />
              <stop offset="100%" className="wm-cash-g1-s2" />
            </linearGradient>
            <linearGradient id="cashNoteGradMid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-cash-g2-s1" />
              <stop offset="100%" className="wm-cash-g2-s2" />
            </linearGradient>
            <linearGradient id="cashNoteGradBack" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-cash-g3-s1" stopOpacity="0.8" />
              <stop offset="100%" className="wm-cash-g3-s2" stopOpacity="0.5" />
            </linearGradient>
          </defs>
    
          <g mask="url(#fadeTopLeftCash)">
            {/* Note 3 (Back Right) */}
            <g transform="rotate(12 90 68)">
              <rect x="42" y="26" width="74" height="42" rx="6" fill="url(#cashNoteGradBack)" className="wm-cash-stroke1" strokeWidth="1.2" />
              <circle cx="79" cy="47" r="7" className="wm-cash-stroke1" strokeWidth="1.2" />
            </g>
    
            {/* Note 2 (Middle) */}
            <g transform="rotate(-2 70 58)">
              <rect x="30" y="24" width="74" height="42" rx="6" fill="url(#cashNoteGradMid)" className="wm-cash-stroke1" strokeWidth="1.4" />
              <rect x="36" y="30" width="62" height="30" rx="4" className="wm-cash-stroke1" strokeWidth="1.2" />
              <circle cx="67" cy="45" r="8" className="wm-cash-stroke2" strokeWidth="1.4" />
            </g>
    
            {/* Note 1 (Front Left - Naira Seal & Lines) */}
            <g transform="rotate(-15 48 54)">
              <rect x="14" y="22" width="74" height="42" rx="6" fill="url(#cashNoteGradFront)" className="wm-cash-stroke2" strokeWidth="1.6" />
              <rect x="20" y="28" width="62" height="30" rx="4" className="wm-cash-stroke2" strokeWidth="1.4" />
              <circle cx="51" cy="43" r="8.5" className="wm-cash-stroke2" strokeWidth="1.6" />
              <text x="51" y="46" textAnchor="middle" className="wm-cash-naira" fontSize="10" fontWeight="bold" fontFamily="sans-serif">₦</text>
              <line x1="24" y1="32" x2="32" y2="32" className="wm-cash-line" strokeWidth="2" strokeLinecap="round" />
              <line x1="70" y1="54" x2="78" y2="54" className="wm-cash-line" strokeWidth="2" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      </div>
  );
}

export function CartWatermark() {
  return (
      <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
        <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <style>{`
              .wm-cart-g1-s1 { stop-color: #D1D5DB; }
              .wm-cart-g1-s2 { stop-color: #9CA3AF; }
              .wm-cart-badge-s1 { stop-color: #9CA3AF; }
              .wm-cart-badge-s2 { stop-color: #64748B; }
              .wm-cart-stroke { stroke: rgba(0, 0, 0, 0.14); }
              .wm-cart-inner-line { stroke: rgba(51, 65, 85, 0.35); }
              .wm-cart-badge-icon { stroke: #334155; }
              .dark .wm-cart-g1-s1 { stop-color: #303030; }
              .dark .wm-cart-g1-s2 { stop-color: #1B1B1B; }
              .dark .wm-cart-badge-s1 { stop-color: #3A3A3A; }
              .dark .wm-cart-badge-s2 { stop-color: #222222; }
              .dark .wm-cart-stroke { stroke: rgba(255, 255, 255, 0.18); }
              .dark .wm-cart-inner-line { stroke: rgba(255, 255, 255, 0.2); }
              .dark .wm-cart-badge-icon { stroke: #FFFFFF; }
            `}</style>
            <linearGradient id="repeatFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.2" />
              <stop offset="50%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
    
            <mask id="fadeTopLeftRepeat">
              <rect x="0" y="0" width="130" height="100" fill="url(#repeatFadeMask)" />
            </mask>
    
            <linearGradient id="cartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-cart-g1-s1" />
              <stop offset="100%" className="wm-cart-g1-s2" />
            </linearGradient>
            <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-cart-badge-s1" />
              <stop offset="100%" className="wm-cart-badge-s2" />
            </linearGradient>
          </defs>
    
          <g mask="url(#fadeTopLeftRepeat)" transform="rotate(-6 65 50)">
            {/* Slanted Cart Basket Body */}
            <path
              d="M 32 32 L 40 64 C 41 67 44 69 47 69 H 87 C 90 69 93 67 94 64 L 102 32 Z"
              fill="url(#cartGrad)"
              className="wm-cart-stroke"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
    
            {/* Soft Rounded Cart Top Flange Rim */}
            <rect
              x="26"
              y="25"
              width="80"
              height="8"
              rx="4"
              fill="url(#cartGrad)"
              className="wm-cart-stroke"
              strokeWidth="1.4"
            />
    
            {/* Rounded Handle Bar */}
            <path
              d="M 14 27 H 26"
              className="wm-cart-inner-line"
              strokeWidth="3"
              strokeLinecap="round"
            />
    
            {/* Slanted inner accent lines inside cart */}
            <line x1="36" y1="44" x2="98" y2="44" className="wm-cart-inner-line" strokeWidth="2" strokeLinecap="round" />
            <line x1="38" y1="55" x2="94" y2="55" className="wm-cart-inner-line" strokeWidth="2" strokeLinecap="round" />
    
            {/* Soft Rounded Cart Wheels */}
            <circle cx="48" cy="76" r="5.5" fill="url(#cartGrad)" className="wm-cart-stroke" strokeWidth="1.5" />
            <circle cx="86" cy="76" r="5.5" fill="url(#cartGrad)" className="wm-cart-stroke" strokeWidth="1.5" />
    
            {/* Repeat Icon Badge at Top Right */}
            <g transform="translate(80, 8)">
              <circle cx="15" cy="15" r="13.5" fill="url(#badgeGrad)" className="wm-cart-stroke" strokeWidth="1.6" />
              <path
                d="M 15 7.5 C 19 7.5 22.2 10.7 22.2 14.7 C 22.2 16 21.8 17.2 21.1 18.2 M 22.2 18.2 L 21.1 18.2 L 20.3 14.7"
                className="wm-cart-badge-icon"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 15 21.9 C 11 21.9 7.8 18.7 7.8 14.7 C 7.8 13.4 8.2 12.2 8.9 11.2 M 7.8 11.2 L 8.9 11.2 L 9.7 14.7"
                className="wm-cart-badge-icon"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        </svg>
      </div>
  );
}

export function ReceiptsWatermark() {
  return (
      <div className="absolute -right-3 -bottom-5 w-32 h-25 pointer-events-none opacity-85 group-hover:scale-105 transition-all duration-300">
        <svg viewBox="0 0 130 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <style>{`
              .wm-rcpt-g1-s1 { stop-color: #D1D5DB; }
              .wm-rcpt-g1-s2 { stop-color: #9CA3AF; }
              .wm-rcpt-g2-s1 { stop-color: #CBD5E1; }
              .wm-rcpt-g2-s2 { stop-color: #64748B; }
              .wm-rcpt-g3-s1 { stop-color: #94A3B8; }
              .wm-rcpt-g3-s2 { stop-color: #475569; }
              .wm-rcpt-stroke { stroke: rgba(0, 0, 0, 0.14); }
              .wm-rcpt-line { stroke: rgba(51, 65, 85, 0.65); }
              .dark .wm-rcpt-g1-s1 { stop-color: #303030; }
              .dark .wm-rcpt-g1-s2 { stop-color: #1B1B1B; }
              .dark .wm-rcpt-g2-s1 { stop-color: #252525; }
              .dark .wm-rcpt-g2-s2 { stop-color: #161616; }
              .dark .wm-rcpt-g3-s1 { stop-color: #1C1C1C; }
              .dark .wm-rcpt-g3-s2 { stop-color: #121212; }
              .dark .wm-rcpt-stroke { stroke: rgba(255, 255, 255, 0.18); }
              .dark .wm-rcpt-line { stroke: rgba(255, 255, 255, 0.85); }
            `}</style>
            <linearGradient id="receiptFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.2" />
              <stop offset="50%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>
    
            <mask id="fadeTopLeftReceipt">
              <rect x="0" y="0" width="130" height="100" fill="url(#receiptFadeMask)" />
            </mask>
    
            <linearGradient id="rcptGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-rcpt-g1-s1" />
              <stop offset="100%" className="wm-rcpt-g1-s2" />
            </linearGradient>
            <linearGradient id="rcptGradMid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-rcpt-g2-s1" />
              <stop offset="100%" className="wm-rcpt-g2-s2" />
            </linearGradient>
            <linearGradient id="rcptGradBack" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="wm-rcpt-g3-s1" stopOpacity="0.8" />
              <stop offset="100%" className="wm-rcpt-g3-s2" stopOpacity="0.5" />
            </linearGradient>
          </defs>
    
          <g mask="url(#fadeTopLeftReceipt)">
            {/* Receipt 3 (Back Right) */}
            <g transform="rotate(10 90 68)">
              <rect x="60" y="24" width="48" height="70" rx="7" fill="url(#rcptGradBack)" className="wm-rcpt-stroke" strokeWidth="1.2" />
            </g>
    
            {/* Receipt 2 (Middle) */}
            <g transform="rotate(-2 72 60)">
              <rect x="42" y="20" width="48" height="70" rx="7" fill="url(#rcptGradMid)" className="wm-rcpt-stroke" strokeWidth="1.4" />
              <line x1="50" y1="48" x2="78" y2="48" className="wm-rcpt-line" strokeWidth="2.5" strokeLinecap="round" />
            </g>
    
            {/* Receipt 1 (Front Left - Notch & Lines) */}
            <g transform="rotate(-15 46 54)">
              <path
                d="M 22 18 L 54 18 L 62 26 L 62 86 C 62 90 58 92 54 92 L 22 92 C 18 92 14 90 14 86 L 14 26 C 14 20 18 18 22 18 Z"
                fill="url(#rcptGradFront)"
                className="wm-rcpt-stroke"
                strokeWidth="1.6"
              />
              <line x1="24" y1="30" x2="38" y2="30" className="wm-rcpt-line" strokeWidth="3" strokeLinecap="round" />
              <line x1="24" y1="48" x2="52" y2="48" className="wm-rcpt-line" strokeWidth="3" strokeLinecap="round" />
              <line x1="24" y1="58" x2="52" y2="58" className="wm-rcpt-line" strokeWidth="3" strokeLinecap="round" />
              <line x1="24" y1="68" x2="52" y2="68" className="wm-rcpt-line" strokeWidth="3" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      </div>
  );
}
