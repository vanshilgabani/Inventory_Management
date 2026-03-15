import { useMemo, useState } from 'react';
import { FiPackage, FiTrendingUp, FiPercent, FiDollarSign, FiInfo } from 'react-icons/fi';

const InputField = ({
  label,
  value,
  onChange,
  prefix = '₹',
  suffix = '',
  tooltip = '',
  step = '0.01',
  min = '0',
}) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {tooltip && (
        <div className="group relative">
          <FiInfo className="w-3 h-3 text-gray-400 cursor-help" />
          <div className="absolute left-0 bottom-5 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 w-56 z-10 shadow-lg">
            {tooltip}
          </div>
        </div>
      )}
    </div>

    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent bg-white">
      {prefix && (
        <span className="px-2 py-2 bg-gray-50 text-gray-500 text-sm border-r border-gray-300">
          {prefix}
        </span>
      )}

      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        step={step}
        className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none bg-white"
      />

      {suffix && (
        <span className="px-2 py-2 bg-gray-50 text-gray-500 text-sm border-l border-gray-300">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const SectionCard = ({ title, icon: Icon, color, children }) => (
  <div className={`bg-white rounded-xl border ${color} shadow-sm`}>
    <div className={`flex items-center gap-2 px-4 py-3 border-b ${color} rounded-t-xl bg-opacity-10`}>
      <Icon className="w-4 h-4" />
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
    </div>
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </div>
);

const MarketplaceProfitCalculator = () => {
  const [inputs, setInputs] = useState({
    bankSettlement: '',
    costPrice: '',
    packagingCost: '',
    repackagingCost: '',
    extraCost: '',
    returnFee: '',
    customerReturnPct: '',
    rtoPct: '',
    wrongReturnPct: '',
    rent: '',
    salary: '',
    otherExpenses: '',
    avgOrdersPerMonth: '',
  });

  const set = (key) => (val) => setInputs((prev) => ({ ...prev, [key]: val }));
  const v = (key) => Math.max(0, parseFloat(inputs[key]) || 0);

  const fmt = (n) =>
    `₹ ${Number(n).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const fmtPct = (n) => `${Number(n).toFixed(2)}%`;

  const calc = useMemo(() => {
    const bankSettlement = v('bankSettlement');
    const costPrice = v('costPrice');
    const packagingCost = v('packagingCost');
    const repackagingCost = v('repackagingCost');
    const extraCost = v('extraCost');
    const returnFee = v('returnFee');

    const customerReturnRate = v('customerReturnPct') / 100;
    const rtoRate = v('rtoPct') / 100;
    const wrongReturnRate = v('wrongReturnPct') / 100;

    const monthlyOverhead = v('rent') + v('salary') + v('otherExpenses');
    const avgOrders = v('avgOrdersPerMonth');

    const totalNonKeepRate = customerReturnRate + rtoRate + wrongReturnRate;
    const ratesValid = totalNonKeepRate <= 1;

    const keptRate = ratesValid ? Math.max(0, 1 - totalNonKeepRate) : 0;
    const overheadPerOrder = avgOrders > 0 ? monthlyOverhead / avgOrders : 0;

    // Your assumptions:
    // 1) bankSettlement = amount received only on a successful kept order
    // 2) customerReturnPct, rtoPct, wrongReturnPct = % of all orders
    // 3) RTO reverse shipping fee = 0
    // 4) wrong return = damaged/wrong item, inventory loss
    // 5) wrong return is treated as a separate bucket (not inside normal customer return)
    const wrongReturnIncludesReturnFee = true;

    // Revenue appears only on kept orders
    const expectedRevenuePerOrder = keptRate * bankSettlement;

    // Cost of goods is consumed only when sale is kept OR product is lost in wrong return
    const expectedCogsPerOrder = (keptRate + wrongReturnRate) * costPrice;

    // Initial packaging is spent on every order shipped once
    const initialPackagingPerOrder = packagingCost;

    // Optional repackaging for sellable customer returns + RTO that come back and are packed again later
    const expectedRepackagingPerOrder = (customerReturnRate + rtoRate) * repackagingCost;

    // Return fee applies on normal customer returns, and optionally on wrong returns
    const expectedReturnFeePerOrder =
      customerReturnRate * returnFee +
      wrongReturnRate * (wrongReturnIncludesReturnFee ? returnFee : 0);

    const totalCostPerOrder =
      expectedCogsPerOrder +
      initialPackagingPerOrder +
      expectedRepackagingPerOrder +
      expectedReturnFeePerOrder +
      extraCost +
      overheadPerOrder;

    const profitPerOrder = expectedRevenuePerOrder - totalCostPerOrder;
    const monthlyProfit = avgOrders > 0 ? profitPerOrder * avgOrders : 0;

    const keptOrdersPerMonth = avgOrders > 0 ? keptRate * avgOrders : 0;
    const profitPerKeptSale = keptOrdersPerMonth > 0 ? monthlyProfit / keptOrdersPerMonth : 0;

    const marginOnExpectedRevenue =
      expectedRevenuePerOrder > 0 ? (profitPerOrder / expectedRevenuePerOrder) * 100 : 0;

    const requiredSettlementPerKeptOrder =
      keptRate > 0 ? totalCostPerOrder / keptRate : 0;

    return {
      bankSettlement,
      costPrice,
      packagingCost,
      repackagingCost,
      extraCost,
      returnFee,
      customerReturnRate,
      rtoRate,
      wrongReturnRate,
      keptRate,
      totalNonKeepRate,
      ratesValid,
      monthlyOverhead,
      overheadPerOrder,
      expectedRevenuePerOrder,
      expectedCogsPerOrder,
      initialPackagingPerOrder,
      expectedRepackagingPerOrder,
      expectedReturnFeePerOrder,
      totalCostPerOrder,
      profitPerOrder,
      monthlyProfit,
      keptOrdersPerMonth,
      profitPerKeptSale,
      marginOnExpectedRevenue,
      requiredSettlementPerKeptOrder,
      isProfit: profitPerOrder >= 0,
      hasData: bankSettlement > 0 && costPrice > 0,
    };
  }, [inputs]);

  const breakdownRows =
    calc.hasData && calc.ratesValid
      ? [
          {
            label: 'Expected Revenue per Order',
            value: calc.expectedRevenuePerOrder,
            color: 'text-green-600',
            sign: '+',
            sub: `${fmtPct(calc.keptRate * 100)} kept orders × ${fmt(calc.bankSettlement)} settlement`,
          },
          {
            label: 'Expected COGS per Order',
            value: -calc.expectedCogsPerOrder,
            color: 'text-red-500',
            sign: '−',
            sub: `${fmtPct((calc.keptRate + calc.wrongReturnRate) * 100)} orders consume stock`,
          },
          {
            label: 'Initial Packaging per Order',
            value: -calc.initialPackagingPerOrder,
            color: 'text-red-500',
            sign: '−',
            sub: 'Counted once on every shipped order',
          },
          {
            label: 'Repackaging Expected Cost',
            value: -calc.expectedRepackagingPerOrder,
            color: 'text-orange-500',
            sign: '−',
            sub:
              calc.repackagingCost > 0
                ? `${fmtPct((calc.customerReturnRate + calc.rtoRate) * 100)} sellable returns/RTO × ${fmt(calc.repackagingCost)}`
                : '0 because repackaging cost is left blank',
          },
          {
            label: 'Return Fee Expected Cost',
            value: -calc.expectedReturnFeePerOrder,
            color: 'text-orange-500',
            sign: '−',
            sub: `${fmtPct((calc.customerReturnRate + calc.wrongReturnRate) * 100)} chargeable return events × ${fmt(calc.returnFee)}`,
          },
          {
            label: 'Overhead per Order',
            value: -calc.overheadPerOrder,
            color: 'text-purple-500',
            sign: '−',
            sub:
              v('avgOrdersPerMonth') > 0
                ? `(${fmt(v('rent'))} rent + ${fmt(v('salary'))} salary + ${fmt(v('otherExpenses'))} other) ÷ ${v('avgOrdersPerMonth')} orders`
                : '',
          },
          {
            label: 'Extra Cost per Order',
            value: -calc.extraCost,
            color: 'text-gray-500',
            sign: '−',
            sub: 'Ads, inserts, handling, QC, etc.',
          },
        ]
      : [];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 p-4">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Marketplace Profit Calculator</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Expected profit model based on all orders, not just successful settlements
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold">Assumptions used</p>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>Bank Settlement = amount received only on a kept/delivered order.</li>
          <li>Customer Return %, RTO %, Wrong Return % are all based on total orders.</li>
          <li>RTO reverse shipping fee is treated as zero.</li>
          <li>Wrong Return is a separate bucket and causes inventory loss.</li>
          <li>Wrong Return is assumed to still incur return fee; change one line if not true for you.</li>
        </ul>
      </div>

      <SectionCard title="Product & Settlement" icon={FiPackage} color="border-blue-200">
        <InputField
          label="Bank Settlement per Kept Order"
          value={inputs.bankSettlement}
          onChange={set('bankSettlement')}
          tooltip="Actual net amount received only when the order is delivered and finally kept"
        />
        <InputField
          label="Cost Price per Piece"
          value={inputs.costPrice}
          onChange={set('costPrice')}
          tooltip="Manufacturing or purchase cost of one unit"
        />
        <InputField
          label="Initial Packaging Cost"
          value={inputs.packagingCost}
          onChange={set('packagingCost')}
          tooltip="Packing used on every shipped order"
        />
        <InputField
          label="Repackaging Cost"
          value={inputs.repackagingCost}
          onChange={set('repackagingCost')}
          tooltip="Optional: packing cost to repack sellable return/RTO for resale; leave 0 if you do not want to count it"
        />
        <InputField
          label="Extra Cost per Order"
          value={inputs.extraCost}
          onChange={set('extraCost')}
          tooltip="Ads, inserts, QC, handling, or any other per-order cost"
        />
      </SectionCard>

      <SectionCard title="Returns & RTO" icon={FiPercent} color="border-orange-200">
        <InputField
          label="Return Fee"
          value={inputs.returnFee}
          onChange={set('returnFee')}
          tooltip="Marketplace return fee charged on customer returns; also applied to wrong returns in this model"
        />
        <InputField
          label="Customer Return %"
          value={inputs.customerReturnPct}
          onChange={set('customerReturnPct')}
          prefix="%"
          tooltip="Normal customer returns as % of all orders; item comes back sellable"
          step="0.1"
        />
        <InputField
          label="RTO %"
          value={inputs.rtoPct}
          onChange={set('rtoPct')}
          prefix="%"
          tooltip="Undelivered returns to origin as % of all orders; no reverse shipping fee assumed"
          step="0.1"
        />
        <InputField
          label="Wrong Return %"
          value={inputs.wrongReturnPct}
          onChange={set('wrongReturnPct')}
          prefix="%"
          tooltip="Wrong/damaged return as % of all orders; treated as inventory loss"
          step="0.1"
        />
      </SectionCard>

      <SectionCard title="Monthly Overhead" icon={FiDollarSign} color="border-purple-200">
        <InputField
          label="Office / Godown Rent"
          value={inputs.rent}
          onChange={set('rent')}
          tooltip="Monthly rent"
        />
        <InputField
          label="Helper / Staff Salary"
          value={inputs.salary}
          onChange={set('salary')}
          tooltip="Total monthly salary"
        />
        <InputField
          label="Other Expenses"
          value={inputs.otherExpenses}
          onChange={set('otherExpenses')}
          tooltip="Electricity, internet, misc"
        />
        <InputField
          label="Avg Orders per Month"
          value={inputs.avgOrdersPerMonth}
          onChange={set('avgOrdersPerMonth')}
          prefix="#"
          tooltip="Used to spread monthly overhead into per-order overhead"
          step="1"
        />
      </SectionCard>

      {calc.hasData && !calc.ratesValid && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Total of Customer Return %, RTO %, and Wrong Return % cannot exceed 100%.
        </div>
      )}

      {calc.hasData && calc.ratesValid && (
        <div className="space-y-4">
          <div
            className={`rounded-xl p-5 text-white shadow-md ${
              calc.isProfit
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : 'bg-gradient-to-r from-red-500 to-red-600'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm opacity-80">
                  {calc.isProfit ? '✅ Expected Profit per Order' : '❌ Expected Loss per Order'}
                </p>
                <p className="text-4xl font-bold mt-1">{fmt(calc.profitPerOrder)}</p>
                <p className="text-sm opacity-80 mt-1">
                  Margin on expected revenue: {fmtPct(calc.marginOnExpectedRevenue)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm opacity-80">Monthly {calc.isProfit ? 'Profit' : 'Loss'}</p>
                <p className="text-2xl font-bold">{fmt(calc.monthlyProfit)}</p>
                <p className="text-sm opacity-80 mt-1">
                  Kept orders/month: {calc.keptOrdersPerMonth.toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Kept Order Rate</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {fmtPct(calc.keptRate * 100)}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Profit per Kept Sale</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {fmt(calc.profitPerKeptSale)}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm text-yellow-800">Break-even Settlement per Kept Order</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">
                {fmt(calc.requiredSettlementPerKeptOrder)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FiTrendingUp className="w-4 h-4" /> Expected Per Order Breakdown
              </h3>
            </div>

            <div className="divide-y divide-gray-100">
              {breakdownRows.map(
                (row, i) =>
                  row.value !== 0 && (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm text-gray-700">{row.label}</p>
                        {row.sub && <p className="text-xs text-gray-400 mt-0.5">{row.sub}</p>}
                      </div>

                      <span className={`text-sm font-semibold ${row.color}`}>
                        {row.sign} {fmt(Math.abs(row.value))}
                      </span>
                    </div>
                  )
              )}

              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <p className="text-sm font-bold text-gray-800">Total Expected Cost / Order</p>
                <span className="text-sm font-bold text-red-600">
                  − {fmt(calc.totalCostPerOrder)}
                </span>
              </div>

              <div
                className={`flex items-center justify-between px-4 py-3 ${
                  calc.isProfit ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <p className="text-sm font-bold text-gray-800">
                  {calc.isProfit ? '✅ Net Expected Profit / Order' : '❌ Net Expected Loss / Order'}
                </p>
                <span
                  className={`text-base font-bold ${
                    calc.isProfit ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {fmt(calc.profitPerOrder)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!calc.hasData && (
        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
          <FiTrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter Bank Settlement and Cost Price to see the corrected profit</p>
        </div>
      )}
    </div>
  );
};

export default MarketplaceProfitCalculator;
