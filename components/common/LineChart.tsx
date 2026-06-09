import React from 'react';

interface LineChartDataPoint {
  label: string; // e.g., 'Tháng 1'
  values: (number | null)[];
}

interface LineChartProps {
  data: LineChartDataPoint[];
  series: { name: string; color: string }[];
  title: string;
}

export const LineChart: React.FC<LineChartProps> = ({ data, series, title }) => {
  const chartHeight = 200;
  const chartWidth = 500; // a nominal width, CSS will make it responsive

  const allValues = data.flatMap(d => d.values).filter(v => v !== null) as number[];
  const maxValue = Math.max(...allValues, 0);

  if (!data || data.length === 0 || allValues.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{title}</h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">Không có dữ liệu để hiển thị.</div>
      </div>
    );
  }

  const getPathD = (seriesIndex: number): string => {
    let path = 'M ';
    const points: [number, number][] = [];
    
    data.forEach((point, pointIndex) => {
      const value = point.values[seriesIndex];
      if (value !== null) {
        const x = (pointIndex / (data.length - 1)) * chartWidth;
        const y = chartHeight - (value / maxValue) * chartHeight;
        points.push([x, y]);
      }
    });

    if (points.length < 2) return '';

    path += `${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i][0]},${points[i][1]}`;
    }
    return path;
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{title}</h3>
      <div className="flex items-center justify-center gap-4 text-sm mb-4">
        {series.map(s => (
          <div key={s.name} className="flex items-center">
            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }}></span>
            <span className="text-gray-600 dark:text-gray-300">{s.name}</span>
          </div>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
          {/* Grid lines */}
          {Array.from({ length: 5 }).map((_, i) => (
             <line key={i} x1="0" y1={(i / 4) * chartHeight} x2={chartWidth} y2={(i / 4) * chartHeight} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.5"/>
          ))}
          {/* Data Lines */}
          {series.map((s, index) => (
             <path key={s.name} d={getPathD(index)} stroke={s.color} fill="none" strokeWidth="2" />
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
        {data.map(d => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
};
