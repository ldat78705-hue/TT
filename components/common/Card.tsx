import React from 'react';

interface CardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement<{ className?: string }>;
  color: string; // Now a text color class, e.g., 'text-blue-600'
}

export const Card: React.FC<CardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="card-base flex items-center p-4">
      <div className={`mr-4 ${color}`}>
        {React.cloneElement(icon, { className: `w-8 h-8 ${icon.props.className || ''}`.trim() })}
      </div>
      <div className="overflow-hidden">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
};