export default function StatsPanel({ data, loading }) {
  const items = [
    { label: "Current NAV",       value: `${Number(data.nav).toFixed(4)} THB` },
    { label: "Your vTHB Shares",  value: Number(data.userShares).toFixed(4) },
    { label: "Your THB Balance",  value: `${Number(data.userThbBalance).toFixed(2)} THB` },
    { label: "Total Shares",      value: Number(data.totalSupply).toFixed(4) },
    { label: "Treasury Balance",  value: `${Number(data.treasuryBalance).toFixed(2)} THB` },
    { label: "Total AUM",         value: `${Number(data.aum).toFixed(2)} THB` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ label, value }) => (
        <div key={label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-lg font-semibold">
            {loading ? <span className="text-gray-600">...</span> : value}
          </p>
        </div>
      ))}
    </div>
  );
}