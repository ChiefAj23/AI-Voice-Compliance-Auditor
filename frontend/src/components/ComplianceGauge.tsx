interface ComplianceGaugeProps {
  score: number;
}

export default function ComplianceGauge({ score }: ComplianceGaugeProps) {
  const getColor = (score: number) => {
    if (score >= 75) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColor = (score: number) => {
    if (score >= 75) return 'text-green-700';
    if (score >= 50) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4">📈 Compliance Gauge</h3>
      <div className="relative w-full h-8 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(score)} transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${getTextColor(score)}`}>
            {score.toFixed(2)} / 100
          </span>
        </div>
      </div>
    </div>
  );
}

