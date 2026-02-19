import { FiCalendar, FiEdit2, FiClock } from 'react-icons/fi';
import { useState, useMemo, useRef } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const getYearOptions = () => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= current - 1; y--) years.push(String(y));
  return years;
};

export const getMonthDateRange = (monthStr, yearStr) => {
  const m = Number(monthStr);
  const y = Number(yearStr);
  const end = new Date(y, m + 1, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    startDate: `${y}-${pad(m + 1)}-01`,
    endDate: `${y}-${pad(m + 1)}-${pad(end.getDate())}`
  };
};

// Auto-inserts hyphens as user types: "10" → "10-", "1011" → "10-11-", "10112025" → "10-11-2025"
const formatDateInput = (value, prev) => {
  // Allow backspace — if deleting, don't auto-add hyphen
  const isDeleting = value.length < prev.length;
  if (isDeleting) return value;

  // Strip all non-digits first
  const digits = value.replace(/\D/g, '');

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
};

const validateDate = (val) => {
  if (!val) return 'Required';
  if (!/^\d{2}-\d{2}-\d{4}$/.test(val)) return 'Use DD-MM-YYYY format';
  const [d, m, y] = val.split('-').map(Number);
  if (m < 1 || m > 12) return 'Invalid month';
  if (d < 1 || d > 31) return 'Invalid day';
  return '';
};

const toISODate = (displayDate) => {
  if (!displayDate) return '';
  const parts = displayDate.split('-');
  if (parts.length !== 3 || parts[2].length !== 4) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

// Props: mode, selectedMonth, selectedYear, onRangeChange, onModeChange, onMonthChange, onYearChange
const TimeRangeSelector = ({
  mode,
  selectedMonth,
  selectedYear,
  onRangeChange,
  onModeChange,
  onMonthChange,
  onYearChange
}) => {
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customStartError, setCustomStartError] = useState('');
  const [customEndError, setCustomEndError] = useState('');

  const startPickerRef = useRef(null);
  const endPickerRef = useRef(null);

  const yearOptions = useMemo(() => getYearOptions(), []);

  const handleMonthChange = (e) => {
    const month = e.target.value;
    onMonthChange(month);
    const range = getMonthDateRange(month, selectedYear);
    onRangeChange({ ...range, filterType: 'month' });
  };

  const handleYearChange = (e) => {
    const year = e.target.value;
    onYearChange(year);
    const range = getMonthDateRange(selectedMonth, year);
    onRangeChange({ ...range, filterType: 'month' });
  };

  const handleSwitchToCustom = () => {
    onModeChange('custom');
    setCustomStart('');
    setCustomEnd('');
    setCustomStartError('');
    setCustomEndError('');
  };

  const handleSwitchToAllTime = () => {
    onModeChange('alltime');
    onRangeChange({ startDate: null, endDate: null, filterType: 'alltime' });
  };

  const handleSwitchToMonth = () => {
    onModeChange('month');
    const range = getMonthDateRange(selectedMonth, selectedYear);
    onRangeChange({ ...range, filterType: 'month' });
  };

  const handleCustomApply = () => {
    const startErr = validateDate(customStart);
    const endErr = validateDate(customEnd);
    setCustomStartError(startErr);
    setCustomEndError(endErr);
    if (startErr || endErr) return;

    const isoStart = toISODate(customStart);
    const isoEnd = toISODate(customEnd);
    if (!isoStart || !isoEnd) return;

    if (new Date(isoStart) > new Date(isoEnd)) {
      setCustomEndError('End date must be after start date');
      return;
    }

    onRangeChange({ startDate: isoStart, endDate: isoEnd, filterType: 'custom' });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">

      {/* ── MODE: MONTH + YEAR ── */}
      {mode === 'month' && (
        <>
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-500" />
            <select
              value={selectedMonth}
              onChange={handleMonthChange}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm cursor-pointer"
            >
              {MONTHS.map((name, idx) => (
                <option key={idx} value={String(idx)}>{name}</option>
              ))}
            </select>
          </div>

          <select
            value={selectedYear}
            onChange={handleYearChange}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm cursor-pointer"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleSwitchToCustom}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm"
          >
            <FiEdit2 size={14} />
            Custom Range
          </button>

          <button
            type="button"
            onClick={handleSwitchToAllTime}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm"
          >
            <FiClock size={14} />
            All Time
          </button>
        </>
      )}

      {/* ── MODE: CUSTOM RANGE ── */}
      {mode === 'custom' && (
        <>
          {/* Start Date */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <FiCalendar className="text-gray-500" />
              <div className="relative">
                <input
                  type="text"
                  placeholder="DD-MM-YYYY"
                  value={customStart}
                  maxLength={10}
                  onChange={(e) => {
                    const formatted = formatDateInput(e.target.value, customStart);
                    setCustomStart(formatted);
                    setCustomStartError('');
                  }}
                  className={`w-36 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm pr-9 ${
                    customStartError ? 'border-red-400' : 'border-gray-300'
                  }`}
                />

                {/* Hidden native date picker */}
                <input
                  type="date"
                  ref={startPickerRef}
                  className="absolute opacity-0 w-0 h-0 top-0 left-0 pointer-events-none"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [y, m, d] = e.target.value.split('-');
                    setCustomStart(`${d}-${m}-${y}`);
                    setCustomStartError('');
                  }}
                />

                {/* Calendar icon button */}
                <button
                  type="button"
                  onClick={() => startPickerRef.current?.showPicker()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            {customStartError && (
              <span className="text-xs text-red-500 mt-1 ml-6">{customStartError}</span>
            )}
          </div>

          <span className="text-gray-500 font-medium text-sm">to</span>

          {/* End Date */}
          <div className="flex flex-col">
            <div className="relative">
              <input
                type="text"
                placeholder="DD-MM-YYYY"
                value={customEnd}
                maxLength={10}
                onChange={(e) => {
                  const formatted = formatDateInput(e.target.value, customEnd);
                  setCustomEnd(formatted);
                  setCustomEndError('');
                }}
                className={`w-36 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm pr-9 ${
                  customEndError ? 'border-red-400' : 'border-gray-300'
                }`}
              />

              {/* Hidden native date picker */}
              <input
                type="date"
                ref={endPickerRef}
                className="absolute opacity-0 w-0 h-0 top-0 left-0 pointer-events-none"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m, d] = e.target.value.split('-');
                  setCustomEnd(`${d}-${m}-${y}`);
                  setCustomEndError('');
                }}
              />

              {/* Calendar icon button */}
              <button
                type="button"
                onClick={() => endPickerRef.current?.showPicker()}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            {customEndError && (
              <span className="text-xs text-red-500 mt-1">{customEndError}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Apply
          </button>

          <button
            type="button"
            onClick={handleSwitchToMonth}
            className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Month View
          </button>
        </>
      )}

      {/* ── MODE: ALL TIME ── */}
      {mode === 'alltime' && (
        <>
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <FiClock className="text-indigo-600" />
            <span className="text-sm font-medium text-indigo-700">All Time</span>
          </div>

          <button
            type="button"
            onClick={handleSwitchToMonth}
            className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Month View
          </button>
        </>
      )}

    </div>
  );
};

export default TimeRangeSelector;
