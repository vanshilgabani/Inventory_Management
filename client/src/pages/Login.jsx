import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

/* ─── Particle canvas hook ─────────────────────────────── */
const useParticleCanvas = (canvasRef) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({ length: 52 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.32,
      r:  Math.random() * 1.6 + 0.7,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16,185,129,0.45)';
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < 115) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(16,185,129,${(0.16 * (1 - d / 115)).toFixed(3)})`;
            ctx.lineWidth = 0.55;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
};

/* ─── Rotating card data ───────────────────────────────── */
const CARDS = [
  {
    icon: '📦',
    title: 'Track across all 3 channels',
    desc:  'Marketplace, Wholesale & Direct Sales — all unified in one dashboard with real-time sync.',
  },
  {
    icon: '📊',
    title: '6 powerful analytics modules',
    desc:  'From return rate per SKU to buyer payment reliability scores — data that drives decisions.',
  },
  {
    icon: '🔁',
    title: 'Smart reorder — never run out',
    desc:  'Velocity-based alerts tell you exactly when to restock fast-movers before they hit zero.',
  },
];

const FEATURES = [
  'Revenue Intelligence',
  'Reorder Planner',
  'Return Rate Tracking',
  'Buyer Scores',
  'Inventory Turnover',
  'Sales Velocity',
];

const TICKER_ITEMS = [
  'REVENUE INTELLIGENCE', 'FLIPKART SYNC', 'SMART REORDER',
  'BUYER ANALYTICS', 'RETURN TRACKING', 'GST BILLING',
  'INVENTORY TURNOVER', 'SALES VELOCITY', 'WHOLESALE ORDERS',
];

/* ─── Component ────────────────────────────────────────── */
const Login = () => {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [cardIndex, setCardIndex]       = useState(0);
  const [cardVisible, setCardVisible]   = useState(true);

  const canvasRef = useRef(null);
  const navigate  = useNavigate();
  const { login } = useAuth();

  useParticleCanvas(canvasRef);

  useEffect(() => {
    // Stagger mount animation
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Rotate cards every 3.2s with fade transition
  useEffect(() => {
    const id = setInterval(() => {
      setCardVisible(false);
      setTimeout(() => {
        setCardIndex(p => (p + 1) % CARDS.length);
        setCardVisible(true);
      }, 350);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        toast.error(result.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800,900&display=swap');

        .gfl-root *, .gfl-root *::before, .gfl-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .gfl-root { font-family: 'Satoshi', 'Inter', sans-serif; }

        /* ── Entrance animations ── */
        @keyframes gfl-fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gfl-cardFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gfl-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes gfl-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes gfl-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.7; }
          50%       { transform: scale(1.08); opacity: 1;   }
        }
        @keyframes gfl-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
        @keyframes gfl-ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes gfl-dotExpand {
          from { width: 6px;  background: rgba(255,255,255,0.2); }
          to   { width: 18px; background: #10b981; }
        }

        /* ── Utility ── */
        .gfl-mounted { animation: gfl-fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .gfl-d1 { animation-delay: 0.06s; }
        .gfl-d2 { animation-delay: 0.12s; }
        .gfl-d3 { animation-delay: 0.18s; }
        .gfl-d4 { animation-delay: 0.24s; }
        .gfl-d5 { animation-delay: 0.30s; }

        /* ── Card visible state ── */
        .gfl-card-visible {
          opacity: 1 !important;
          transform: translateY(0) !important;
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .gfl-card-hidden {
          opacity: 0 !important;
          transform: translateY(8px) !important;
          transition: opacity 0.35s ease, transform 0.35s ease;
        }

        /* ── Submit button ── */
        .gfl-btn {
          background: linear-gradient(90deg, #059669 0%, #10b981 40%, #047857 70%, #10b981 100%);
          background-size: 200% auto;
          transition: background-position 0.4s ease, transform 0.15s ease, box-shadow 0.2s ease;
        }
        .gfl-btn:hover:not(:disabled) {
          animation: gfl-shimmer 1.6s linear infinite;
          box-shadow: 0 8px 28px rgba(16, 185, 129, 0.42);
          transform: translateY(-1px);
        }
        .gfl-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .gfl-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        /* ── Input ── */
        .gfl-input {
          width: 100%;
          padding: 0.9rem 1rem 0.9rem 2.85rem;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 13px;
          font-size: 0.88rem;
          color: #0f172a;
          outline: none;
          font-family: 'Satoshi', sans-serif;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .gfl-input:focus {
          border-color: #10b981;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
        }
        .gfl-input::placeholder { color: #cbd5e1; }
        .gfl-input:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Register outline button ── */
        .gfl-outline-btn {
          width: 100%;
          padding: 0.9rem;
          border-radius: 13px;
          background: transparent;
          border: 2px solid #e2e8f0;
          color: #10b981;
          font-weight: 700;
          font-size: 0.875rem;
          cursor: pointer;
          font-family: 'Satoshi', sans-serif;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .gfl-outline-btn:hover {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.04);
        }

        /* ── Glow orbs ── */
        .gfl-glow1 {
          position: absolute; top: -80px; left: -80px;
          width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%);
          animation: gfl-pulse 7s ease-in-out infinite;
          pointer-events: none;
        }
        .gfl-glow2 {
          position: absolute; bottom: -60px; right: -60px;
          width: 360px; height: 360px; border-radius: 50%;
          background: radial-gradient(circle, rgba(5,150,105,0.1) 0%, transparent 70%);
          animation: gfl-pulse 9s ease-in-out infinite reverse;
          pointer-events: none;
        }

        /* ── Ticker ── */
        .gfl-ticker-wrap {
          overflow: hidden;
          white-space: nowrap;
          -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
          mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
        }
        .gfl-ticker-inner {
          display: inline-flex;
          gap: 2rem;
          animation: gfl-ticker 22s linear infinite;
          font-size: 0.65rem;
          color: rgba(52, 211, 153, 0.28);
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* ── Responsive: hide left panel on mobile ── */
        @media (max-width: 1023px) {
          .gfl-left  { display: none !important; }
          .gfl-right { width: 100% !important; }
          .gfl-mobile-logo { display: flex !important; }
        }
        @media (min-width: 1024px) {
          .gfl-mobile-logo { display: none !important; }
        }
      `}</style>

      <div
        className="gfl-root"
        style={{ minHeight: '100vh', display: 'flex', overflow: 'hidden', background: '#fff' }}
      >
        {/* ══════════ LEFT — Brand Panel ══════════ */}
        <div
          className="gfl-left"
          style={{
            width: '52%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2.5rem 3.5rem',
            overflow: 'hidden',
            background: 'linear-gradient(145deg, #022c22 0%, #064e3b 55%, #065f46 100%)',
          }}
        >
          {/* Canvas particles */}
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
          {/* Glow orbs */}
          <div className="gfl-glow1" />
          <div className="gfl-glow2" />

          {/* ── TOP content ── */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2.5rem' }}>
              <div
                style={{
                  width: '42px', height: '42px', borderRadius: '12px', overflow: 'hidden',
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <img
                  src="/logoGF.png"
                  alt="GarmentFlow"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML =
                      '<span style="color:#fff;font-weight:900;font-size:.95rem;font-family:Satoshi,sans-serif">GF</span>';
                  }}
                />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>GarmentFlow</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(110,231,183,0.65)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
                  Inventory System
                </div>
              </div>
            </div>

            {/* Headline */}
            <h2 style={{
              fontWeight: 900, fontSize: 'clamp(1.75rem, 2.5vw, 2.5rem)',
              lineHeight: 1.1, letterSpacing: '-0.04em', color: '#fff', marginBottom: '0.75rem',
            }}>
              Wholesale intelligence,<br />
              <span style={{
                background: 'linear-gradient(90deg, #6ee7b7, #a7f3d0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                built for garments.
              </span>
            </h2>
            <p style={{ color: 'rgba(167,243,208,0.55)', fontSize: '0.875rem', lineHeight: 1.7, maxWidth: '330px', marginBottom: '2rem' }}>
              Track inventory, sync marketplace orders, and analyse performance across all your sales channels.
            </p>

            {/* Live badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.75rem' }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%', background: '#34d399',
                animation: 'gfl-blink 2.2s ease-in-out infinite',
              }} />
              <span style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                All systems live
              </span>
            </div>

            {/* ── Rotating card ── */}
            <div style={{ height: '108px', position: 'relative', marginBottom: '1rem' }}>
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  opacity: cardVisible ? 1 : 0,
                  transform: cardVisible ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 0.35s ease, transform 0.35s ease',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px',
                }}>
                  {CARDS[cardIndex].icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#d1fae5', fontSize: '0.875rem', marginBottom: '4px' }}>
                    {CARDS[cardIndex].title}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'rgba(167,243,208,0.55)', lineHeight: 1.55 }}>
                    {CARDS[cardIndex].desc}
                  </div>
                </div>
              </div>
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '2rem' }}>
              {CARDS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCardIndex(i)}
                  style={{
                    width: i === cardIndex ? '18px' : '6px',
                    height: '6px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                    background: i === cardIndex ? '#10b981' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.3s ease',
                    padding: 0,
                  }}
                />
              ))}
            </div>

            {/* Feature grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {FEATURES.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ color: 'rgba(110,231,183,0.6)', fontSize: '11px', fontWeight: 700 }}>✓</span>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(203,213,225,0.5)', fontWeight: 600 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOTTOM — Ticker + copyright ── */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="gfl-ticker-wrap">
              <div className="gfl-ticker-inner">
                {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
                  <span key={i}>✦ {t}</span>
                ))}
              </div>
            </div>
            <p style={{ color: 'rgba(52,211,153,0.18)', fontSize: '0.65rem', marginTop: '12px' }}>
              © 2025 GarmentFlow Inventory System
            </p>
          </div>
        </div>

        {/* ══════════ RIGHT — Form Panel ══════════ */}
        <div
          className="gfl-right"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem', background: '#fff' }}
        >
          <div style={{ width: '100%', maxWidth: '400px' }}>

            {/* Mobile logo */}
            <div
              className="gfl-mobile-logo"
              style={{ alignItems: 'center', gap: '10px', marginBottom: '2rem', justifyContent: 'center' }}
            >
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src="/logoGF.png" alt="GF"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span style="color:#fff;font-weight:900">GF</span>'; }}
                />
              </div>
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>GarmentFlow</span>
            </div>

            {/* Heading */}
            <div className={mounted ? 'gfl-mounted' : ''} style={{ marginBottom: '2rem', opacity: mounted ? undefined : 0 }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                GarmentFlow
              </p>
              <h1 style={{ fontWeight: 900, fontSize: '1.875rem', color: '#0f172a', letterSpacing: '-0.03em', marginBottom: '0.4rem', lineHeight: 1.15 }}>
                Welcome back 👋
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Sign in to manage your inventory & analytics
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

              {/* Email */}
              <div className={mounted ? 'gfl-mounted gfl-d1' : ''} style={{ opacity: mounted ? undefined : 0 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.45rem', letterSpacing: '0.01em' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <FiMail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} size={15} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="gfl-input"
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                    style={{ paddingLeft: '2.75rem' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className={mounted ? 'gfl-mounted gfl-d2' : ''} style={{ opacity: mounted ? undefined : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', letterSpacing: '0.01em' }}>
                    Password
                  </label>
                  <span
                    onClick={() => navigate('/forgot-password')}
                    style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#047857'}
                    onMouseLeave={e => e.currentTarget.style.color = '#059669'}
                  >
                    Forgot password?
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <FiLock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} size={15} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="gfl-input"
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    style={{ paddingLeft: '2.75rem', paddingRight: '3rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#94a3b8', display: 'flex', alignItems: 'center',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#10b981'}
                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                  >
                    {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className={mounted ? 'gfl-mounted gfl-d3' : ''} style={{ opacity: mounted ? undefined : 0, marginTop: '0.25rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="gfl-btn"
                  style={{
                    width: '100%', padding: '1rem', borderRadius: '13px',
                    fontWeight: 800, color: '#fff', fontSize: '0.9rem',
                    border: 'none', letterSpacing: '0.01em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? (
                    <>
                      <svg
                        style={{ animation: 'gfl-spin 0.8s linear infinite', width: '17px', height: '17px', flexShrink: 0 }}
                        fill="none" viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity=".25" />
                        <path fill="#fff" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </>
                  ) : 'Sign In →'}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div
              className={mounted ? 'gfl-mounted gfl-d4' : ''}
              style={{ opacity: mounted ? undefined : 0, display: 'flex', alignItems: 'center', gap: '12px', margin: '1.4rem 0' }}
            >
              <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>NEW HERE?</span>
              <div style={{ flex: 1, height: '1px', background: '#f1f5f9' }} />
            </div>

            {/* Register CTA */}
            <div className={mounted ? 'gfl-mounted gfl-d5' : ''} style={{ opacity: mounted ? undefined : 0 }}>
              <button className="gfl-outline-btn" onClick={() => navigate('/register')}>
                Create free account — 7 day trial
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;