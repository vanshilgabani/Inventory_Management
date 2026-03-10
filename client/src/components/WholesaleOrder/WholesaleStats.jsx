export default function WholesaleStats({ orderStats = {} }) {
  const {
    totalOrders = 0, totalRevenue = 0, totalCollected = 0,
    totalDue = 0, pendingCount = 0, partialCount = 0, paidCount = 0,
  } = orderStats;

  const fmt = n =>
    n >= 1e7 ? `₹${(n / 1e7).toFixed(2)}Cr`
    : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L`
    : n >= 1e3 ? `₹${(n / 1e3).toFixed(1)}K`
    : `₹${Math.round(n)}`;

  const cards = [
    {
      label: 'Total Orders',
      value: totalOrders,
      sub: `${paidCount} fully paid`,
      bg: '#EEF2FF', border: '#C7D2FE', color: '#4F46E5', icon: '🛒',
    },
    {
      label: 'Pending Due',
      value: fmt(totalDue),
      sub: `${pendingCount} unpaid orders`,
      bg: '#FFF7ED', border: '#FED7AA', color: '#EA580C', icon: '⏳',
    },
    {
      label: 'Collected',
      value: fmt(totalCollected),
      sub: `of ${fmt(totalRevenue)} total`,
      bg: '#F0FDF4', border: '#BBF7D0', color: '#16A34A', icon: '✅',
    },
    {
      label: 'Partial Orders',
      value: partialCount,
      sub: 'partially paid',
      bg: '#FEFCE8', border: '#FEF08A', color: '#CA8A04', icon: '⚡',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div
          key={c.label}
          style={{ background: c.bg, borderColor: c.border }}
          className="rounded-xl border-2 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</span>
            <span className="text-lg">{c.icon}</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
          <div className="text-xs text-gray-500 mt-1">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
