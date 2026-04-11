import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';
import {
  FiMail, FiLock, FiUser, FiBriefcase,
  FiPhone, FiEye, FiEyeOff, FiArrowRight,
} from 'react-icons/fi';

/* ─── Particle canvas hook (same as Login) ─────────────── */
const useParticleCanvas = (canvasRef) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const pts = Array.from({ length: 52 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.32, vy: (Math.random() - 0.5) * 0.32,
      r: Math.random() * 1.6 + 0.7,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16,185,129,0.45)'; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < 115) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(16,185,129,${(0.16 * (1 - d / 115)).toFixed(3)})`;
            ctx.lineWidth = 0.55; ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
};

/* ─── Data ─────────────────────────────────────────────── */
const ANALYTICS_ITEMS = [
  { icon: '📈', title: 'Revenue Intelligence',   desc: 'MoM, YoY growth + quarterly forecast with linear regression' },
  { icon: '🔁', title: 'Smart Reorder Planner',  desc: 'Days-on-Hand alerts — restock before you run out' },
  { icon: '📦', title: 'Return Rate Analytics',  desc: 'RTO, wrong-return & cancellation rates per SKU' },
  { icon: '🤝', title: 'Buyer Performance',       desc: 'Payment reliability scores & top buyer ranking' },
  { icon: '⚡', title: 'Sales Velocity Tracker', desc: 'Daily units sold per SKU across all 3 channels' },
  { icon: '🗂️', title: 'Inventory Turnover',     desc: 'Fast / Average / Slow mover classification' },
];

const TICKER_ITEMS = [
  'REVENUE INTELLIGENCE', 'FLIPKART SYNC', 'SMART REORDER',
  'BUYER ANALYTICS', 'RETURN TRACKING', 'GST BILLING',
  'INVENTORY TURNOVER', 'SALES VELOCITY', 'WHOLESALE ORDERS',
];

const FIELDS = [
  { name: 'name',         label: 'Full Name',       type: 'text',     Icon: FiUser,      placeholder: 'Your full name'            },
  { name: 'email',        label: 'Email Address',   type: 'email',    Icon: FiMail,      placeholder: 'your@email.com'            },
  { name: 'password',     label: 'Password',        type: 'password', Icon: FiLock,      placeholder: 'Min. 6 characters'         },
  { name: 'businessName', label: 'Business Name',   type: 'text',     Icon: FiBriefcase, placeholder: 'Your business / shop name' },
  { name: 'phone',        label: 'Phone Number',    type: 'tel',      Icon: FiPhone,     placeholder: '10-digit mobile number', pattern: '[0-9]{10}' },
];

/* ─── Component ────────────────────────────────────────── */
const Register = ({ setUser }) => {
  const [formData, setFormData]         = useState({ name: '', email: '', password: '', businessName: '', phone: '' });
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [activeCard, setActiveCard]     = useState(0);

  const canvasRef = useRef(null);
  const navigate  = useNavigate();

  useParticleCanvas(canvasRef);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Highlight features one by one
  useEffect(() => {
    const id = setInterval(() => setActiveCard(p => (p + 1) % ANALYTICS_ITEMS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const handleChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await authService.register(formData);
      if (setUser) setUser(response);
      toast.success('Account created! Welcome to GarmentFlow 🎉');
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800,900&display=swap');

        .gfr-root *, .gfr-root *::before, .gfr-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .gfr-root { font-family: 'Satoshi', 'Inter', sans-serif; }

        @keyframes gfr-fadeUp  { from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);} }
        @keyframes gfr-shimmer { 0%{background-position:-200% center;}100%{background-position:200% center;} }
        @keyframes gfr-spin    { to{transform:rotate(360deg);} }
        @keyframes gfr-pulse   { 0%,100%{transform:scale(1);opacity:.7;}50%{transform:scale(1.08);opacity:1;} }
        @keyframes gfr-blink   { 0%,100%{opacity:1;}50%{opacity:.2;} }
        @keyframes gfr-ticker  { from{transform:translateX(0);}to{transform:translateX(-50%);} }

        .gfr-mounted { animation: gfr-fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .gfr-d1 { animation-delay:0.06s; } .gfr-d2 { animation-delay:0.12s; }
        .gfr-d3 { animation-delay:0.18s; } .gfr-d4 { animation-delay:0.24s; }
        .gfr-d5 { animation-delay:0.30s; } .gfr-d6 { animation-delay:0.36s; }
        .gfr-d7 { animation-delay:0.42s; }

        .gfr-btn {
          background: linear-gradient(90deg,#059669 0%,#10b981 40%,#047857 70%,#10b981 100%);
          background-size: 200% auto;
          transition: background-position .4s ease, transform .15s ease, box-shadow .2s ease;
        }
        .gfr-btn:hover:not(:disabled) {
          animation: gfr-shimmer 1.6s linear infinite;
          box-shadow: 0 8px 28px rgba(16,185,129,.42);
          transform: translateY(-1px);
        }
        .gfr-btn:active:not(:disabled) { transform: translateY(0); }
        .gfr-btn:disabled { background: #9ca3af; cursor: not-allowed; }

        .gfr-input {
          width:100%; padding:.9rem 1rem .9rem 2.85rem;
          background:#f8fafc; border:2px solid #e2e8f0; border-radius:13px;
          font-size:.875rem; color:#0f172a; outline:none;
          font-family:'Satoshi',sans-serif;
          transition: border-color .2s, background .2s, box-shadow .2s;
        }
        .gfr-input:focus { border-color:#10b981; background:#fff; box-shadow:0 0 0 4px rgba(16,185,129,.1); }
        .gfr-input::placeholder { color:#cbd5e1; }
        .gfr-input:disabled { opacity:.6; cursor:not-allowed; }

        /* Feature item hover/active */
        .gfr-feat-item {
          display:flex; align-items:flex-start; gap:12px;
          padding:11px 14px; border-radius:12px;
          transition: background .3s ease, transform .3s ease;
          cursor: default;
        }
        .gfr-feat-item.active {
          background: rgba(255,255,255,.09);
          transform: translateX(5px);
        }

        .gfr-glow1 {
          position:absolute; top:-80px; left:-80px;
          width:400px; height:400px; border-radius:50%;
          background:radial-gradient(circle,rgba(16,185,129,.14) 0%,transparent 70%);
          animation:gfr-pulse 7s ease-in-out infinite; pointer-events:none;
        }
        .gfr-glow2 {
          position:absolute; bottom:-60px; right:-60px;
          width:360px; height:360px; border-radius:50%;
          background:radial-gradient(circle,rgba(5,150,105,.1) 0%,transparent 70%);
          animation:gfr-pulse 9s ease-in-out infinite reverse; pointer-events:none;
        }

        .gfr-ticker-wrap {
          overflow:hidden; white-space:nowrap;
          -webkit-mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent);
          mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent);
        }
        .gfr-ticker-inner {
          display:inline-flex; gap:2rem;
          animation:gfr-ticker 22s linear infinite;
          font-size:.65rem; color:rgba(52,211,153,.28);
          font-weight:600; letter-spacing:.06em; text-transform:uppercase;
        }

        @media (max-width:1023px) {
          .gfr-right  { display:none !important; }
          .gfr-left   { width:100% !important; overflow-y:auto !important; }
          .gfr-mobile-logo { display:flex !important; }
        }
        @media (min-width:1024px) {
          .gfr-mobile-logo { display:none !important; }
        }
      `}</style>

      <div className="gfr-root" style={{ minHeight: '100vh', display: 'flex', overflow: 'hidden', background: '#f0fdf4' }}>

        {/* ══════════ LEFT — Form Panel ══════════ */}
        <div
          className="gfr-left"
          style={{ width: '54%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#fff' }}
        >
          <div style={{ width: '100%', maxWidth: '440px', padding: '1rem 0' }}>

            {/* Mobile logo */}
            <div className="gfr-mobile-logo" style={{ alignItems: 'center', gap: '10px', marginBottom: '2rem', justifyContent: 'center' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/logoGF.png" alt="GF" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span style="color:#fff;font-weight:900">GF</span>'; }} />
              </div>
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>GarmentFlow</span>
            </div>

            {/* Heading */}
            <div className={mounted ? 'gfr-mounted' : ''} style={{ marginBottom: '1.75rem', opacity: mounted ? undefined : 0 }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>GarmentFlow</p>
              <h1 style={{ fontWeight: 900, fontSize: '1.875rem', color: '#0f172a', letterSpacing: '-0.03em', marginBottom: '0.4rem', lineHeight: 1.15 }}>
                Create your account
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Start your 7-day free trial today
              </p>
            </div>

            {/* Progress steps */}
            <div className={mounted ? 'gfr-mounted gfr-d1' : ''} style={{ display: 'flex', gap: '6px', marginBottom: '1.75rem', opacity: mounted ? undefined : 0 }}>
              {['Account Info', 'Business', 'Contact'].map((s, i) => (
                <div key={i} style={{ flex: 1 }}>
                  <div style={{
                    height: '3px', borderRadius: '3px', marginBottom: '4px',
                    background: i === 0 ? '#10b981' : i === 1 ? 'rgba(16,185,129,.4)' : 'rgba(16,185,129,.15)',
                    transition: 'all .3s ease',
                  }} />
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: i === 0 ? '#059669' : '#94a3b8' }}>{s}</span>
                </div>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {FIELDS.map(({ name, label, type, Icon, placeholder, pattern }, idx) => {
                const delay = `gfr-d${idx + 2}`; // d2 → d6
                const isPassword = name === 'password';
                const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
                return (
                  <div key={name} className={mounted ? `gfr-mounted ${delay}` : ''} style={{ opacity: mounted ? undefined : 0 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.45rem', letterSpacing: '0.01em' }}>
                      {label} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Icon
                        style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}
                        size={15}
                      />
                      <input
                        type={inputType}
                        name={name}
                        value={formData[name]}
                        onChange={handleChange}
                        placeholder={placeholder}
                        pattern={pattern}
                        required
                        disabled={loading}
                        className="gfr-input"
                        style={{ paddingLeft: '2.75rem', paddingRight: isPassword ? '3rem' : '1rem' }}
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => !p)}
                          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', transition: 'color .2s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#10b981'}
                          onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                        >
                          {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Submit */}
              <div className={mounted ? 'gfr-mounted gfr-d7' : ''} style={{ opacity: mounted ? undefined : 0, marginTop: '0.25rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="gfr-btn"
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
                      <svg style={{ animation: 'gfr-spin .8s linear infinite', width: '17px', height: '17px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity=".25" />
                        <path fill="#fff" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating your account...
                    </>
                  ) : (
                    <> Create Free Account <FiArrowRight size={16} /> </>
                  )}
                </button>
              </div>
            </form>

            {/* Sign in link */}
            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: '#64748b' }}>
              Already have an account?{' '}
              <Link
                to="/login"
                style={{ color: '#059669', fontWeight: 700, textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#047857'}
                onMouseLeave={e => e.currentTarget.style.color = '#059669'}
              >
                Sign in
              </Link>
            </div>

            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.6 }}>
              By creating an account you agree to our Terms of Service.<br />
              Your data is secured with 256-bit encryption.
            </p>
          </div>
        </div>

        {/* ══════════ RIGHT — Brand Panel ══════════ */}
        <div
          className="gfr-right"
          style={{
            flex: 1, position: 'relative', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', padding: '2.5rem 3rem', overflow: 'hidden',
            background: 'linear-gradient(145deg, #022c22 0%, #064e3b 55%, #065f46 100%)',
          }}
        >
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          <div className="gfr-glow1" />
          <div className="gfr-glow2" />

          {/* ── TOP ── */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2.5rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.15)', backdropFilter: 'blur(10px)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/logoGF.png" alt="GF" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span style="color:#fff;font-weight:900;font-size:.95rem">GF</span>'; }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>GarmentFlow</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(110,231,183,.65)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>Inventory System</div>
              </div>
            </div>

            <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.5rem, 2.2vw, 2.25rem)', lineHeight: 1.1, letterSpacing: '-0.04em', color: '#fff', marginBottom: '0.75rem' }}>
              Everything you need<br />
              <span style={{ background: 'linear-gradient(90deg,#6ee7b7,#a7f3d0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                to scale wholesale.
              </span>
            </h2>
            <p style={{ color: 'rgba(167,243,208,.55)', fontSize: '0.85rem', lineHeight: 1.7, maxWidth: '300px', marginBottom: '1.75rem' }}>
              6 analytics modules, 3 sales channels, and smart AI-driven restocking — all in one platform.
            </p>

            {/* Live badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.75rem' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', animation: 'gfr-blink 2.2s ease-in-out infinite' }} />
              <span style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>All systems live</span>
            </div>

            {/* Channel badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
              {['📦 Marketplace', '🤝 Wholesale', '💼 Direct Sales'].map((ch, i) => (
                <span key={i} style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(16,185,129,.18)', border: '1px solid rgba(16,185,129,.3)', color: '#a7f3d0', letterSpacing: '0.02em' }}>
                  {ch}
                </span>
              ))}
            </div>

            {/* Analytics feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {ANALYTICS_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className={`gfr-feat-item ${activeCard === i ? 'active' : ''}`}
                >
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                    background: activeCard === i ? 'rgba(16,185,129,.25)' : 'rgba(16,185,129,.1)',
                    border: `1px solid ${activeCard === i ? 'rgba(16,185,129,.4)' : 'rgba(16,185,129,.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', transition: 'all .3s ease',
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: activeCard === i ? '#d1fae5' : 'rgba(209,250,229,.55)', marginBottom: '1px', transition: 'color .3s' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: activeCard === i ? 'rgba(167,243,208,.65)' : 'rgba(167,243,208,.3)', lineHeight: 1.45, transition: 'color .3s' }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOTTOM ── */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Trial callout */}
            <div style={{
              background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
              backdropFilter: 'blur(14px)', borderRadius: '14px', padding: '14px 18px',
              marginBottom: '1.25rem',
            }}>
              <div style={{ fontWeight: 700, color: '#d1fae5', fontSize: '0.82rem', marginBottom: '3px' }}>🎉 7-day free trial</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(167,243,208,.55)', lineHeight: 1.5 }}>
                Full access to all 6 analytics modules, all 3 sales channels, GST billing, and smart reorder alerts.
              </div>
            </div>
            <div className="gfr-ticker-wrap">
              <div className="gfr-ticker-inner">
                {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
                  <span key={i}>✦ {t}</span>
                ))}
              </div>
            </div>
            <p style={{ color: 'rgba(52,211,153,.18)', fontSize: '0.65rem', marginTop: '12px' }}>
              © 2025 GarmentFlow Inventory System
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;