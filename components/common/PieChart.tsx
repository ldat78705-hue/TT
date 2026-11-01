import React from 'react';

interface PieChartDataPoint {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartDataPoint[];
  title: string;
}

const PALETTE = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6', '#d946ef', '#64748b'];

export const PieChart: React.FC<PieChartProps> = ({ data, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
     return (
        <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{title}</h3>
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">Không có dữ liệu để hiển thị.</div>
        </div>
    );
  }

  let cumulativePercentage = 0;

  const segments = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const dashArray = `${percentage} ${100 - percentage}`;
    const dashOffset = 25 - cumulativePercentage; // Start from the top
    cumulativePercentage += percentage;

    return {
      ...item,
      color: item.color || PALETTE[index % PALETTE.length],
      dashArray,
      dashOffset,
      percentage,
    };
  });

  return (
    <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{title}</h3>
        <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-40 h-40">
                 <svg viewBox="0 0 32 32" className="transform -rotate-90">
                    {segments.map((segment) => (
                        <circle
                            key={segment.label}
                            r="16"
                            cx="16"
                            cy="16"
                            fill="transparent"
                            stroke={segment.color}
                            strokeWidth="32"
                            strokeDasharray={segment.dashArray}
                            strokeDashoffset={segment.dashOffset}
                        />
                    ))}
                </svg>
            </div>
            <div className="flex-1 space-y-2">
                {segments.map(segment => (
                    <div key={segment.label} className="flex items-center text-sm">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: segment.color }}></span>
                        <span className="text-gray-600 dark:text-gray-300">{segment.label}</span>
                        <span className="ml-auto font-semibold text-gray-800 dark:text-white">{segment.percentage.toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};