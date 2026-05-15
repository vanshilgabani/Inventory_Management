import { useState, useMemo } from 'react';
import { FiEdit, FiTrash2, FiPlus, FiDollarSign } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

const PaymentsTab = ({ receivings, onAdd, onEdit, onDelete, canEditDelete }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [form, setForm] = useState({
    paymentAmount: '',
    sourceName: '',
    paidToType: 'factory',   
    paymentNotes: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

  // Filter only payment records
const payments = useMemo(() =>
  (receivings || [])
    .filter(r => r.sourceType === 'payment' && !r.deletedAt)
    .sort((a, b) => new Date(b.paymentDate || b.createdAt) - new Date(a.paymentDate || a.createdAt)),
  [receivings]
);

const availableYears = useMemo(() => {
  const years = [...new Set(
    payments.map(p => new Date(p.paymentDate || p.createdAt).getFullYear())
  )].sort((a, b) => b - a);
  return years;
}, [payments]);

const filtered = useMemo(() => {
  let result = [...payments];

  // Search by sourceName, notes, amount
  if (search.trim()) {
    const s = search.toLowerCase().trim();
    result = result.filter(p => {
      const amountString = String(p.paymentAmount || '');
      return (
        p.sourceName?.toLowerCase().includes(s) ||
        p.paymentNotes?.toLowerCase().includes(s) ||
        p.notes?.toLowerCase().includes(s) ||
        amountString.includes(s)
      );
    });
  }

  // Integrated year filter
  if (selectedYear !== 'all') {
    result = result.filter(p => {
      const d = new Date(p.paymentDate || p.createdAt);
      return String(d.getFullYear()) === String(selectedYear);
    });
  }

  // Integrated month filter
  if (selectedMonth !== 'all') {
    result = result.filter(p => {
      const d = new Date(p.paymentDate || p.createdAt);
      return d.getMonth() === Number(selectedMonth);
    });
  }

  // Custom date range
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    result = result.filter(p => {
      const d = new Date(p.paymentDate || p.createdAt);
      return d >= fromDate;
    });
  }

  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    result = result.filter(p => {
      const d = new Date(p.paymentDate || p.createdAt);
      return d <= toDate;
    });
  }

  return result;
}, [payments, search, selectedYear, selectedMonth, dateFrom, dateTo]);

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const hasActiveFilters = useMemo(() => {
  return (
    search.trim() !== '' ||
    selectedYear !== 'all' ||
    selectedMonth !== 'all' ||
    dateFrom !== '' ||
    dateTo !== ''
  );
}, [search, selectedYear, selectedMonth, dateFrom, dateTo]);

const activeFilters = useMemo(() => {
  const chips = [];

  if (search.trim()) {
    chips.push({
      key: 'search',
      label: `Search: ${search}`,
      onRemove: () => setSearch(''),
    });
  }

  if (selectedYear !== 'all') {
    chips.push({
      key: 'year',
      label: `Year: ${selectedYear}`,
      onRemove: () => setSelectedYear('all'),
    });
  }

  if (selectedMonth !== 'all') {
    chips.push({
      key: 'month',
      label: `Month: ${monthNames[Number(selectedMonth)]}`,
      onRemove: () => setSelectedMonth('all'),
    });
  }

  if (dateFrom) {
    chips.push({
      key: 'from',
      label: `From: ${dateFrom}`,
      onRemove: () => setDateFrom(''),
    });
  }

  if (dateTo) {
    chips.push({
      key: 'to',
      label: `To: ${dateTo}`,
      onRemove: () => setDateTo(''),
    });
  }

  return chips;
}, [search, selectedYear, selectedMonth, dateFrom, dateTo]);

const totalPaidAllTime = useMemo(() =>
  payments.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0),
  [payments]
);

const paidThisMonthAll = useMemo(() => {
  const now = new Date();
  return payments
    .filter(p => {
      const d = new Date(p.paymentDate || p.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);
}, [payments]);

const filteredTotalPaid = useMemo(() =>
  filtered.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0),
  [filtered]
);

    const totalPaid = useMemo(() =>
    filtered.reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0),
    [filtered]
    );

    const filteredCount = useMemo(() => filtered.length, [filtered]);

    const thisMonthPaid = useMemo(() => {
    const now = new Date();
    return filtered
        .filter(p => {
        const d = new Date(p.paymentDate || p.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, p) => sum + (Number(p.paymentAmount) || 0), 0);
    }, [filtered]);

  const resetForm = () => setForm({
    paymentAmount: '', sourceName: '', paidToType: 'factory', paymentNotes: '',
    paymentDate: new Date().toISOString().split('T')[0], notes: '',
  });

  const handleOpenAdd = () => { resetForm(); setEditingPayment(null); setShowAddModal(true); };

  const handleOpenEdit = (payment) => {
    setEditingPayment(payment);
    setForm({
        paymentAmount: payment.paymentAmount || '',
        sourceName: payment.sourceName || '',
        paidToType: payment.sourceName ? 'other' : 'factory',  // ← ADD THIS
        paymentNotes: payment.paymentNotes || '',
        paymentDate: payment.paymentDate
        ? new Date(payment.paymentDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
        notes: payment.notes || '',
    });
    setShowAddModal(true);
    };

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!form.paymentAmount || Number(form.paymentAmount) <= 0) {
    alert('Please enter a valid amount'); return;
  }
  if (form.paidToType === 'other' && !form.sourceName.trim()) {
    alert('Please specify the name'); return;
  }
  setSubmitting(true);
  try {
    const payload = {
      ...form,
      sourceName: form.paidToType === 'factory' ? 'Factory' : form.sourceName.trim(),
    };
    if (editingPayment) {
      await onEdit(editingPayment._id, payload);
    } else {
      await onAdd(payload);
    }
    setShowAddModal(false);
    resetForm();
    setEditingPayment(null);
  } catch (err) {
    console.error(err);
  } finally {
    setSubmitting(false);
  }
};

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment record?')) return;
    await onDelete(id);
  };

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!hasActiveFilters ? (
            <>
            <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-green-500">
                <p className="text-sm text-gray-500">Total Paid (All Time)</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                ₹{totalPaidAllTime.toLocaleString('en-IN')}
                </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-blue-500">
                <p className="text-sm text-gray-500">Paid This Month</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                ₹{paidThisMonthAll.toLocaleString('en-IN')}
                </p>
            </div>
            </>
        ) : (
            <>
            <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-green-500">
                <p className="text-sm text-gray-500">Filtered Total Paid</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                ₹{filteredTotalPaid.toLocaleString('en-IN')}
                </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-blue-500">
                <p className="text-sm text-gray-500">Filtered Records</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                {filteredCount}
                </p>
            </div>
            </>
        )}
        </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, notes, or amount..."
            className="w-full lg:max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />

            <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow font-medium text-sm"
            >
            <FiPlus /> Add Payment
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {/* Year Filter */}
            <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
            <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
                <option value="all">All Years</option>
                {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
                ))}
            </select>
            </div>

            {/* Month Filter */}
            <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
            <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
                <option value="all">All Months</option>
                <option value="0">January</option>
                <option value="1">February</option>
                <option value="2">March</option>
                <option value="3">April</option>
                <option value="4">May</option>
                <option value="5">June</option>
                <option value="6">July</option>
                <option value="7">August</option>
                <option value="8">September</option>
                <option value="9">October</option>
                <option value="10">November</option>
                <option value="11">December</option>
            </select>
            </div>

            {/* Custom From */}
            <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            </div>

            {/* Custom To */}
            <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
            <button
                onClick={() => {
                setSearch('');
                setSelectedYear('all');
                setSelectedMonth('all');
                setDateFrom('');
                setDateTo('');
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
                Clear Filters
            </button>
            </div>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Active Filters:</span>

            {activeFilters.map(filter => (
                <span
                key={filter.key}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-sm font-medium"
                >
                {filter.label}
                <button
                    type="button"
                    onClick={filter.onRemove}
                    className="text-blue-500 hover:text-blue-700 font-bold leading-none"
                    title={`Remove ${filter.label}`}
                >
                    ×
                </button>
                </span>
            ))}

            <button
                type="button"
                onClick={() => {
                setSearch('');
                setSelectedYear('all');
                setSelectedMonth('all');
                setDateFrom('');
                setDateTo('');
                }}
                className="ml-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
            >
                Clear All
            </button>
            </div>
        </div>
        )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No payment records found</h3>
            <p className="text-gray-500 text-sm">
            {activeFilters.length > 0
                ? 'Try changing or clearing the active filters.'
                : 'Click "Add Payment" to record a factory payment.'}
            </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Paid To</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Recorded By</th>
                {canEditDelete && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(payment => (
                <tr key={payment._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {payment.paymentDate
                      ? format(new Date(payment.paymentDate), 'dd MMM yyyy')
                      : format(new Date(payment.createdAt), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {payment.sourceName || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                      ₹{(payment.paymentAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {payment.paymentNotes || payment.notes || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{payment.receivedBy || '—'}</td>
                  {canEditDelete && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenEdit(payment)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit">
                          <FiEdit />
                        </button>
                        <button onClick={() => handleDelete(payment._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingPayment ? 'Edit Payment' : 'Add Payment'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Amount */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input type="number" min="1" step="0.01" required
                value={form.paymentAmount}
                onChange={e => setForm({ ...form, paymentAmount: e.target.value })}
                placeholder="Enter amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Paid To — Dropdown */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid To</label>
                <select
                value={form.paidToType}
                onChange={e => setForm({ ...form, paidToType: e.target.value, sourceName: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                <option value="factory">Factory</option>
                <option value="other">Other</option>
                </select>
            </div>

            {/* Show input only when "Other" is selected */}
            {form.paidToType === 'other' && (
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Specify Name <span className="text-red-500">*</span>
                </label>
                <input type="text" required
                    value={form.sourceName}
                    onChange={e => setForm({ ...form, sourceName: e.target.value })}
                    placeholder="e.g. Ramesh Supplier, Surat Mills..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
                </div>
            )}

            {/* Payment Date */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input type="date"
                value={form.paymentDate}
                onChange={e => setForm({ ...form, paymentDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Notes */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={3}
                value={form.paymentNotes}
                onChange={e => setForm({ ...form, paymentNotes: e.target.value })}
                placeholder="e.g. Payment for May batch, D9 order..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-2">
                <button type="button"
                onClick={() => { setShowAddModal(false); resetForm(); setEditingPayment(null); }}
                className="px-5 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                disabled={submitting}>Cancel</button>
                <button type="submit" disabled={submitting}
                className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:from-green-600 hover:to-emerald-700 font-medium disabled:opacity-50">
                {submitting ? 'Saving...' : editingPayment ? 'Update' : 'Save Payment'}
                </button>
            </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsTab;