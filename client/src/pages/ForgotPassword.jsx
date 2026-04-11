import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiArrowRight, FiShield } from 'react-icons/fi';

const API = import.meta.env.VITE_API_URL || '';

/* ── Particle canvas (same as Login) ── */
const useParticleCanvas = (canvasRef) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.4 + 0.6,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16,185,129,0.4)'; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 110) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(16,185,129,${(0.14 * (1 - d / 110)).toFixed(3)})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
};

/* ── OTP Input boxes (6 individual inputs) ── */
const OTPInput = ({ value, onChange, disabled }) => {
  const refs = Array.from({ length: 6 }, () => useRef(null));
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const next = digits.map((d, idx) => idx === i ? '' : d).join('');
      onChange(next);
      if (i > 0) refs[i - 1].current?.focus();
    } else if (/^[0-9]$/.test(e.key)) {
      const next = digits.map((d, idx) => idx === i ? e.key : d).join('');
      onChange(next);
      if (i < 5) refs[i + 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); refs[Math.min(pasted.length, 5)].current?.focus(); }
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={() => {}}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          style={{
            width: '46px', height: '54px', textAlign: 'center', fontSize: '1.4rem',
            fontWeight: 800, fontFamily: "'Satoshi', sans-serif",
            border: `2px solid ${d ? '#10b981' : '#e2e8f0'}`,
            borderRadius: '12px', outline: 'none', background: d ? '#f0fdf4' : '#f8fafc',
            color: '#0f172a', transition: 'border-color .2s, background .2s',
            caretColor: 'transparent',
          }}
          onFocus={e => e.target.style.borderColor = '#10b981'}
          onBlur={e => e.target.style.borderColor = digits[i] ? '#10b981' : '#e2e8f0'}
        />
      ))}
    </div>
  );
};

/* ── Main Component ── */
const ForgotPassword = () => {
  const [step, setStep]               = useState(1);  // 1=email, 2=otp, 3=new-password
  const [email, setEmail]             = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp]                 = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [showCPwd, setShowCPwd]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [mounted, setMounted]         = useState(false);

  const canvasRef = useRef(null);
  const navigate  = useNavigate();

  useParticleCanvas(canvasRef);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer(p => p - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  /* ── Step 1: Request OTP ── */
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/forgot-password`, { email });
      setMaskedEmail(data.email || email);
      setResendTimer(60);
      toast.success('OTP sent! Check your email.');
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong';
      if (err.response?.data?.blocked) {
        toast.error(msg, { duration: 5000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend OTP ── */
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      setResendTimer(60);
      setOtp('');
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend OTP');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: Verify OTP ── */
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter the complete 6-digit OTP'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/verify-otp`, { email, otp });
      toast.success('OTP verified!');
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 3: Reset Password ── */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPwd) { toast.error('Fill in all fields'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPwd) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { email, newPassword, confirmPassword: confirmPwd });
      toast.success('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const STEPS = ['Email', 'OTP Verification', 'New Password'];

  return (
    <>
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,800,900&display=swap');
        .gfp-root *, .gfp-root *::before, .gfp-root *::after { box-sizing:border-box; margin:0; padding:0; }
        .gfp-root { font-family:'Satoshi','Inter',sans-serif; }

        @keyframes gfp-fadeUp  { from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);} }
        @keyframes gfp-shimmer { 0%{background-position:-200% center;}100%{background-position:200% center;} }
        @keyframes gfp-spin    { to{transform:rotate(360deg);} }
        @keyframes gfp-pulse   { 0%,100%{transform:scale(1);opacity:.7;}50%{transform:scale(1.08);opacity:1;} }
        @keyframes gfp-stepIn  { from{opacity:0;transform:translateX(28px);}to{opacity:1;transform:translateX(0);} }

        .gfp-mounted { animation: gfp-fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .gfp-d1{animation-delay:.06s;} .gfp-d2{animation-delay:.12s;}
        .gfp-d3{animation-delay:.18s;} .gfp-d4{animation-delay:.24s;}
        .gfp-step-enter { animation: gfp-stepIn 0.42s cubic-bezier(0.22,1,0.36,1) both; }

        .gfp-btn {
          background:linear-gradient(90deg,#059669 0%,#10b981 40%,#047857 70%,#10b981 100%);
          background-size:200% auto;
          transition:background-position .4s ease,transform .15s ease,box-shadow .2s ease;
        }
        .gfp-btn:hover:not(:disabled){
          animation:gfp-shimmer 1.6s linear infinite;
          box-shadow:0 8px 28px rgba(16,185,129,.42);
          transform:translateY(-1px);
        }
        .gfp-btn:active:not(:disabled){ transform:translateY(0); }
        .gfp-btn:disabled{ background:#9ca3af; cursor:not-allowed; }

        .gfp-input {
          width:100%; padding:.9rem 1rem .9rem 2.85rem;
          background:#f8fafc; border:2px solid #e2e8f0; border-radius:13px;
          font-size:.875rem; color:#0f172a; outline:none;
          font-family:'Satoshi',sans-serif;
          transition:border-color .2s,background .2s,box-shadow .2s;
        }
        .gfp-input:focus{border-color:#10b981;background:#fff;box-shadow:0 0 0 4px rgba(16,185,129,.1);}
        .gfp-input::placeholder{color:#cbd5e1;}
        .gfp-input:disabled{opacity:.6;cursor:not-allowed;}

        .gfp-glow1{position:absolute;top:-80px;left:-80px;width:350px;height:350px;border-radius:50%;background:radial-gradient(circle,rgba(16,185,129,.14) 0%,transparent 70%);animation:gfp-pulse 7s ease-in-out infinite;pointer-events:none;}
        .gfp-glow2{position:absolute;bottom:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(5,150,105,.1) 0%,transparent 70%);animation:gfp-pulse 9s ease-in-out infinite reverse;pointer-events:none;}

        .gfp-resend-btn{background:none;border:none;font-family:'Satoshi',sans-serif;font-size:.8rem;font-weight:700;cursor:pointer;transition:color .2s;}

        @media(max-width:1023px){
          .gfp-left{display:none!important;}
          .gfp-right{width:100%!important;}
        }
      `}</style>

      <div className="gfp-root" style={{ minHeight: '100vh', display: 'flex', overflow: 'hidden', background: '#fff' }}>

        {/* ══ LEFT — Brand Panel ══ */}
        <div
          className="gfp-left"
          style={{
            width: '48%', position: 'relative', display: 'flex', flexDirection: 'column',
            justifyContent: 'center', padding: '3rem 4rem', overflow: 'hidden',
            background: 'linear-gradient(145deg,#022c22 0%,#064e3b 55%,#065f46 100%)',
          }}
        >
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          <div className="gfp-glow1" /><div className="gfp-glow2" />

          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '3rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.15)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/logoGF.png" alt="GF" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span style="color:#fff;font-weight:900;font-size:.95rem">GF</span>'; }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>GarmentFlow</div>
                <div style={{ fontSize: '0.62rem', color: 'rgba(110,231,183,.65)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 500 }}>Inventory System</div>
              </div>
            </div>

            {/* Lock icon */}
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(16,185,129,.18)', border: '1px solid rgba(16,185,129,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.75rem' }}>
              <FiShield size={28} color="#6ee7b7" />
            </div>

            <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.6rem,2.2vw,2.25rem)', lineHeight: 1.1, letterSpacing: '-.04em', color: '#fff', marginBottom: '.75rem' }}>
              Secure password<br />
              <span style={{ background: 'linear-gradient(90deg,#6ee7b7,#a7f3d0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                reset for admins.
              </span>
            </h2>
            <p style={{ color: 'rgba(167,243,208,.55)', fontSize: '.875rem', lineHeight: 1.7, maxWidth: '300px', marginBottom: '2rem' }}>
              A time-limited OTP is sent directly to your registered admin email. It expires in 10 minutes and can only be used once.
            </p>

            {/* Steps info */}
            {[
              { n: '01', t: 'Enter your email',    d: 'We verify it belongs to an admin account' },
              { n: '02', t: 'Enter the OTP',        d: 'Check your inbox for the 6-digit code' },
              { n: '03', t: 'Set new password',     d: 'Your new password is encrypted instantly' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: '16px', opacity: step > i ? 1 : 0.45, transition: 'opacity .4s' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: step > i ? 'rgba(16,185,129,.3)' : 'rgba(16,185,129,.1)', border: `1px solid ${step > i ? 'rgba(16,185,129,.5)' : 'rgba(16,185,129,.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.62rem', fontWeight: 800, color: step > i ? '#6ee7b7' : 'rgba(110,231,183,.4)', letterSpacing: '.02em' }}>
                  {step > i + 1 ? '✓' : s.n}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.82rem', color: step > i ? '#d1fae5' : 'rgba(209,250,229,.4)', marginBottom: '2px' }}>{s.t}</div>
                  <div style={{ fontSize: '.7rem', color: step > i ? 'rgba(167,243,208,.55)' : 'rgba(167,243,208,.25)' }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT — Form Panel ══ */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem', background: '#fff' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>

            {/* Progress bar */}
            <div className={mounted ? 'gfp-mounted' : ''} style={{ marginBottom: '2rem', opacity: mounted ? undefined : 0 }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ height: '3px', borderRadius: '3px', background: i < step ? '#10b981' : i === step - 1 ? 'rgba(16,185,129,.4)' : '#e2e8f0', transition: 'background .4s ease' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {STEPS.map((s, i) => (
                  <span key={i} style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: i + 1 === step ? '#059669' : '#94a3b8' }}>{s}</span>
                ))}
              </div>
            </div>

            {/* ── STEP 1: Email ── */}
            {step === 1 && (
              <div className="gfp-step-enter">
                <div style={{ marginBottom: '1.75rem' }}>
                  <p style={{ fontSize: '.72rem', fontWeight: 700, color: '#10b981', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.6rem' }}>Admin Access</p>
                  <h1 style={{ fontWeight: 900, fontSize: '1.75rem', color: '#0f172a', letterSpacing: '-.03em', marginBottom: '.4rem', lineHeight: 1.15 }}>Forgot password?</h1>
                  <p style={{ color: '#64748b', fontSize: '.875rem', lineHeight: 1.6 }}>Enter your registered admin email and we'll send a one-time password.</p>
                </div>
                <form onSubmit={handleRequestOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '.8rem', fontWeight: 700, color: '#374151', marginBottom: '.45rem' }}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <FiMail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} size={15} />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="gfp-input" placeholder="your@email.com" required disabled={loading} style={{ paddingLeft: '2.75rem' }} />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="gfp-btn" style={{ width: '100%', padding: '1rem', borderRadius: '13px', fontWeight: 800, color: '#fff', fontSize: '.9rem', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {loading ? <><svg style={{ animation: 'gfp-spin .8s linear infinite', width: '17px', height: '17px' }} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity=".25"/><path fill="#fff" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending OTP...</> : <>Send OTP <FiArrowRight size={16} /></>}
                  </button>
                </form>
              </div>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 2 && (
              <div className="gfp-step-enter">
                <div style={{ marginBottom: '1.75rem' }}>
                  <p style={{ fontSize: '.72rem', fontWeight: 700, color: '#10b981', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.6rem' }}>Step 2 of 3</p>
                  <h1 style={{ fontWeight: 900, fontSize: '1.75rem', color: '#0f172a', letterSpacing: '-.03em', marginBottom: '.4rem', lineHeight: 1.15 }}>Enter OTP</h1>
                  <p style={{ color: '#64748b', fontSize: '.875rem', lineHeight: 1.6 }}>
                    We sent a 6-digit code to <strong style={{ color: '#0f172a' }}>{maskedEmail}</strong>. Valid for 10 minutes.
                  </p>
                </div>
                <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <OTPInput value={otp} onChange={setOtp} disabled={loading} />

                  {/* Timer & resend */}
                  <div style={{ textAlign: 'center' }}>
                    {resendTimer > 0 ? (
                      <p style={{ fontSize: '.8rem', color: '#94a3b8' }}>
                        Resend OTP in <strong style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>0:{String(resendTimer).padStart(2,'0')}</strong>
                      </p>
                    ) : (
                      <p style={{ fontSize: '.8rem', color: '#64748b' }}>
                        Didn't receive it?{' '}
                        <button className="gfp-resend-btn" style={{ color: loading ? '#94a3b8' : '#059669' }} onClick={handleResend} disabled={loading} type="button">
                          Resend OTP
                        </button>
                      </p>
                    )}
                  </div>

                  <button type="submit" disabled={loading || otp.length !== 6} className="gfp-btn" style={{ width: '100%', padding: '1rem', borderRadius: '13px', fontWeight: 800, color: '#fff', fontSize: '.9rem', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {loading ? <><svg style={{ animation: 'gfp-spin .8s linear infinite', width: '17px', height: '17px' }} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity=".25"/><path fill="#fff" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Verifying...</> : <>Verify OTP <FiArrowRight size={16} /></>}
                  </button>

                  <button type="button" onClick={() => { setStep(1); setOtp(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center', fontFamily: "'Satoshi',sans-serif", fontWeight: 600 }}>
                    <FiArrowLeft size={13} /> Back to email
                  </button>
                </form>
              </div>
            )}

            {/* ── STEP 3: New Password ── */}
            {step === 3 && (
              <div className="gfp-step-enter">
                <div style={{ marginBottom: '1.75rem' }}>
                  <p style={{ fontSize: '.72rem', fontWeight: 700, color: '#10b981', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.6rem' }}>Step 3 of 3</p>
                  <h1 style={{ fontWeight: 900, fontSize: '1.75rem', color: '#0f172a', letterSpacing: '-.03em', marginBottom: '.4rem', lineHeight: 1.15 }}>Set new password</h1>
                  <p style={{ color: '#64748b', fontSize: '.875rem', lineHeight: 1.6 }}>Choose a strong password for your admin account.</p>
                </div>
                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '.8rem', fontWeight: 700, color: '#374151', marginBottom: '.45rem' }}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <FiLock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} size={15} />
                      <input type={showPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="gfp-input" placeholder="Min. 6 characters" required disabled={loading} style={{ paddingLeft: '2.75rem', paddingRight: '3rem' }} />
                      <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#10b981'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                        {showPwd ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '.8rem', fontWeight: 700, color: '#374151', marginBottom: '.45rem' }}>Confirm New Password</label>
                    <div style={{ position: 'relative' }}>
                      <FiLock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} size={15} />
                      <input type={showCPwd ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="gfp-input" placeholder="Re-enter password" required disabled={loading} style={{ paddingLeft: '2.75rem', paddingRight: '3rem' }} />
                      <button type="button" onClick={() => setShowCPwd(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#10b981'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                        {showCPwd ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                    {/* Live match indicator */}
                    {confirmPwd && (
                      <p style={{ fontSize: '.72rem', marginTop: '5px', color: newPassword === confirmPwd ? '#059669' : '#ef4444', fontWeight: 600 }}>
                        {newPassword === confirmPwd ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </p>
                    )}
                  </div>
                  <button type="submit" disabled={loading || newPassword !== confirmPwd || !newPassword} className="gfp-btn" style={{ width: '100%', padding: '1rem', borderRadius: '13px', fontWeight: 800, color: '#fff', fontSize: '.9rem', border: 'none', marginTop: '.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {loading ? <><svg style={{ animation: 'gfp-spin .8s linear infinite', width: '17px', height: '17px' }} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" opacity=".25"/><path fill="#fff" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Resetting...</> : <>Reset Password ✓</>}
                  </button>
                </form>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '.875rem', color: '#64748b' }}>
              <Link to="/login" style={{ color: '#059669', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                onMouseEnter={e => e.currentTarget.style.color = '#047857'}
                onMouseLeave={e => e.currentTarget.style.color = '#059669'}>
                <FiArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;