import React, { useRef, useEffect, useState } from "react";

const styles = `
  @keyframes drawPhase {
    0%   { transform: rotateX(28deg) rotateY(-20deg) rotateZ(-2deg); }
    70%  { transform: rotateX(28deg) rotateY(-20deg) rotateZ(-2deg); }
    85%  { transform: rotateX(18deg) rotateY(0deg)   rotateZ(0deg);  }
    92%  { transform: rotateX(22deg) rotateY(12deg)  rotateZ(1deg);  }
    100% { transform: rotateX(28deg) rotateY(-20deg) rotateZ(-2deg); }
  }
  @keyframes drawStroke {
    0%   { stroke-dashoffset: 1400; opacity: 1; }
    68%  { stroke-dashoffset: 0;    opacity: 1; }
    82%  { opacity: 1; }
    90%  { opacity: 0.3; }
    100% { stroke-dashoffset: 0;    opacity: 1; }
  }
  @keyframes fillGlow {
    0%   { fill-opacity: 0;    }
    65%  { fill-opacity: 0;    }
    80%  { fill-opacity: 0.12; }
    92%  { fill-opacity: 0.05; }
    100% { fill-opacity: 0;    }
  }
  @keyframes shimmerMove {
    0%   { transform: translateX(-220px); opacity: 0;   }
    68%  { transform: translateX(-220px); opacity: 0;   }
    75%  { opacity: 0.25; }
    87%  { transform: translateX(220px);  opacity: 0.25;}
    92%  { opacity: 0; }
    100% { transform: translateX(-220px); opacity: 0;   }
  }
  @keyframes barFill {
    0%   { width: 0%;   }
    68%  { width: 100%; }
    90%  { width: 100%; }
    100% { width: 0%;   }
  }
  @keyframes labelPulse {
    0%, 100% { opacity: 1;    }
    50%       { opacity: 0.35; }
  }
  @keyframes groundBreath {
    0%, 100% { transform: scaleX(1);   opacity: 0.45; }
    50%       { transform: scaleX(0.5);opacity: 0.15; }
  }
  /* micro spinner fallback for tiny containers */
  @keyframes microSpin {
    to { transform: rotate(360deg); }
  }

  .cgp-wrap {
    transform-style: preserve-3d;
    animation: drawPhase 3s ease-in-out infinite;
    filter:
      drop-shadow(-6px 12px 18px rgba(37,99,235,0.25))
      drop-shadow(3px -2px 6px rgba(147,197,253,0.20))
      drop-shadow(0 6px 24px rgba(59,130,246,0.20));
  }
  .cgp-draw {
    stroke-dasharray: 1400;
    stroke-dashoffset: 1400;
    animation: drawStroke 3s ease-in-out infinite;
  }
  .cgp-fill  { animation: fillGlow     3s ease-in-out infinite; fill-opacity: 0; }
  .cgp-shim  { animation: shimmerMove  3s ease-in-out infinite; }
  .cgp-bar   { animation: barFill      3s ease-in-out infinite; }
  .cgp-label { animation: labelPulse   3s ease-in-out infinite; }
  .cgp-gnd   { animation: groundBreath 3s ease-in-out infinite; }
  .d0  { animation-delay: 0s;    }
  .d1  { animation-delay: 0.06s; }
  .d2  { animation-delay: 0.12s; }
  .d3  { animation-delay: 0.18s; }
  .d4  { animation-delay: 0.24s; }
  .d5  { animation-delay: 0.30s; }
  .d6  { animation-delay: 0.36s; }
  .d7  { animation-delay: 0.42s; }
  .d8  { animation-delay: 0.48s; }
  .d9  { animation-delay: 0.54s; }
  .d10 { animation-delay: 0.60s; }
  .d11 { animation-delay: 0.66s; }
  .d12 { animation-delay: 0.72s; }
  .d13 { animation-delay: 0.78s; }
`;

// Breakpoints for size behaviour
const SIZE_FULL   = 120; // container px — show full pant loader
const SIZE_MICRO  = 60;  // container px — show tiny spinner only

const Loader = ({ message = "Loading...", fullScreen = true }) => {
  const containerRef = useRef(null);
  const [pantSize, setPantSize]   = useState({ w: 150, h: 195 });
  const [mode, setMode]           = useState("full"); // "full" | "compact" | "micro"

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const smaller = Math.min(width, height);

      if (smaller < SIZE_MICRO) {
        setMode("micro");
      } else if (smaller < SIZE_FULL) {
        setMode("compact");
        // scale pant to 55% of the smaller dimension
        const scale = (smaller * 0.55) / 150;
        setPantSize({ w: Math.round(150 * scale), h: Math.round(195 * scale) });
      } else {
        setMode("full");
        // scale pant to 30% of the smaller dimension, capped at 180px
        const raw = smaller * 0.30;
        const capped = Math.min(raw, 180);
        setPantSize({ w: Math.round(capped), h: Math.round(capped * 1.3) });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const overlayStyle = {
    // fixed = whole screen | absolute = inside parent only
    position: fullScreen ? "fixed" : "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    zIndex: 9999,
    gap: mode === "micro" ? "4px" : mode === "compact" ? "8px" : "14px",
    perspective: "900px",
    borderRadius: fullScreen ? "0px" : "inherit", // inherit parent's border-radius
  };

  // ── MICRO MODE: just a small blue spinner ──
  if (mode === "micro") {
    return (
      <>
        <style>{styles}</style>
        <div ref={containerRef} style={overlayStyle}>
          <div style={{
            width: "22px", height: "22px",
            border: "3px solid #dbeafe",
            borderTop: "3px solid #2563eb",
            borderRadius: "50%",
            animation: "microSpin 0.8s linear infinite",
          }} />
        </div>
      </>
    );
  }

  // ── COMPACT MODE: pant only, no label/bar ──
  if (mode === "compact") {
    return (
      <>
        <style>{styles}</style>
        <div ref={containerRef} style={overlayStyle}>
          <div className="cgp-wrap">
            <CargoPantSVG w={pantSize.w} h={pantSize.h} />
          </div>
        </div>
      </>
    );
  }

  // ── FULL MODE: pant + label + progress bar ──
  return (
    <>
      <style>{styles}</style>
      <div ref={containerRef} style={overlayStyle}>

        <p className="cgp-label" style={{
          fontSize: "11px",
          color: "#1d4ed8",
          letterSpacing: "3.5px",
          textTransform: "uppercase",
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
        }}>
          {message}
        </p>

        <div className="cgp-wrap">
          <CargoPantSVG w={pantSize.w} h={pantSize.h} />
        </div>

        <div className="cgp-gnd" style={{
          width: `${pantSize.w * 0.8}px`,
          height: "14px",
          background: "radial-gradient(ellipse, rgba(59,130,246,0.20) 0%, transparent 70%)",
          borderRadius: "50%",
          marginTop: "-6px",
        }} />

        <div style={{
          width: `${pantSize.w * 0.8}px`,
          height: "3px",
          background: "#dbeafe",
          borderRadius: "4px",
          overflow: "hidden",
          border: "1px solid #bfdbfe",
        }}>
          <div className="cgp-bar" style={{
            height: "100%",
            background: "linear-gradient(90deg, #1e40af, #2563eb, #60a5fa, #2563eb)",
            borderRadius: "4px",
            boxShadow: "0 0 8px rgba(59,130,246,0.5)",
            width: "0%",
          }} />
        </div>

      </div>
    </>
  );
};

// ── Extracted SVG so all 3 modes reuse it ──
const CargoPantSVG = ({ w, h }) => (
  <svg width={w} height={h} viewBox="0 0 200 270" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cgpShimmer" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0" />
        <stop offset="50%"  stopColor="#bfdbfe" stopOpacity="1" />
        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
      </linearGradient>
      <clipPath id="cgpClip">
        <path d="M28 8 L172 8 L172 26 C172 26 175 70 175 95 Q100 108 25 95 C25 70 28 26 28 26Z
                 M25 95 L15 255 Q55 262 93 255 L100 108Z
                 M175 95 L185 255 Q145 262 107 255 L100 108Z" />
      </clipPath>
    </defs>

    {/* Depth layer */}
    <g transform="translate(5,6)" opacity="0.18">
      <rect x="28" y="8" width="144" height="18" rx="4" stroke="#1e40af" strokeWidth="3" fill="none" />
      <path d="M28 26 C28 26 25 70 25 95 Q100 108 175 95 C175 70 172 26 172 26Z" stroke="#1e40af" strokeWidth="2.5" fill="none" />
      <path d="M25 95 L15 255 Q55 262 93 255 L100 108" stroke="#1e40af" strokeWidth="2.5" fill="none" />
      <path d="M175 95 L185 255 Q145 262 107 255 L100 108" stroke="#1e40af" strokeWidth="2.5" fill="none" />
      <rect x="12"  y="138" width="38" height="50" rx="4" stroke="#1e40af" strokeWidth="2" fill="none" />
      <rect x="150" y="138" width="38" height="50" rx="4" stroke="#1e40af" strokeWidth="2" fill="none" />
    </g>

    {/* Fills */}
    <path className="cgp-fill" fill="#3b82f6" d="M28 26 C28 26 25 70 25 95 Q100 108 175 95 C175 70 172 26 172 26Z" />
    <path className="cgp-fill" fill="#3b82f6" d="M25 95 L15 255 Q55 262 93 255 L100 108Z" />
    <path className="cgp-fill" fill="#3b82f6" d="M175 95 L185 255 Q145 262 107 255 L100 108Z" />

    {/* Waistband */}
    <rect className="cgp-draw d0" x="28" y="8" width="144" height="18" rx="4" stroke="#2563eb" strokeWidth="3.5" fill="none" />
    {/* Belt loops */}
    <rect className="cgp-draw d1" x="48"  y="5" width="12" height="12" rx="2" stroke="#2563eb" strokeWidth="2.5" fill="none" />
    <rect className="cgp-draw d2" x="94"  y="5" width="12" height="12" rx="2" stroke="#2563eb" strokeWidth="2.5" fill="none" />
    <rect className="cgp-draw d3" x="140" y="5" width="12" height="12" rx="2" stroke="#2563eb" strokeWidth="2.5" fill="none" />
    {/* Body */}
    <path className="cgp-draw d4" d="M28 26 C28 26 25 70 25 95 Q100 108 175 95 C175 70 172 26 172 26Z" stroke="#2563eb" strokeWidth="3" fill="none" />
    {/* Legs */}
    <path className="cgp-draw d5" d="M25 95 L15 255 Q55 262 93 255 L100 108" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" fill="none" />
    <path className="cgp-draw d6" d="M175 95 L185 255 Q145 262 107 255 L100 108" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" fill="none" />
    {/* Left pocket */}
    <rect className="cgp-draw d7" x="12" y="138" width="38" height="50" rx="4" stroke="#2563eb" strokeWidth="2.5" fill="none" />
    <line className="cgp-draw d8" x1="12" y1="154" x2="50" y2="154" stroke="#2563eb" strokeWidth="2" />
    <circle className="cgp-draw d9" cx="31" cy="148" r="4" stroke="#2563eb" strokeWidth="2" fill="none" />
    {/* Right pocket */}
    <rect className="cgp-draw d8" x="150" y="138" width="38" height="50" rx="4" stroke="#2563eb" strokeWidth="2.5" fill="none" />
    <line className="cgp-draw d9" x1="150" y1="154" x2="188" y2="154" stroke="#2563eb" strokeWidth="2" />
    <circle className="cgp-draw d10" cx="169" cy="148" r="4" stroke="#2563eb" strokeWidth="2" fill="none" />
    {/* Slash pockets */}
    <path className="cgp-draw d11" d="M52 26 Q42 54 36 75" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path className="cgp-draw d11" d="M148 26 Q158 54 164 75" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* Fly seam */}
    <line className="cgp-draw d12" x1="100" y1="26" x2="100" y2="108" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="5 4" />
    {/* Hems */}
    <line className="cgp-draw d13" x1="17"  y1="244" x2="91"  y2="244" stroke="#2563eb" strokeWidth="2.5" />
    <line className="cgp-draw d13" x1="109" y1="244" x2="183" y2="244" stroke="#2563eb" strokeWidth="2.5" />
    {/* Knee stitching */}
    <line className="cgp-draw d12" x1="20"  y1="178" x2="88"  y2="181" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
    <line className="cgp-draw d12" x1="112" y1="181" x2="180" y2="178" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
    {/* Shimmer */}
    <rect className="cgp-shim" y="0" width="80" height="280" fill="url(#cgpShimmer)" clipPath="url(#cgpClip)" opacity="0" />
  </svg>
);

export default Loader;