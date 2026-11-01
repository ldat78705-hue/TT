
import React from 'react';

interface ListItemCardProps {
  title: React.ReactNode;
  details: { label: string; value: React.ReactNode }[];
  status?: { text: string; colorClasses: string };
  actions?: React.ReactNode;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const ListItemCard: React.FC<ListItemCardProps> = ({ title, details, status, actions, onSelect, isSelected }) => {
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent click from triggering when clicking on buttons, links, or the checkbox itself
    if (e.target instanceof HTMLElement) {
        if (e.target.closest('button, a, input[type="checkbox"]')) {
            return;
        }
    }
    onSelect?.();
  };
  
  return (
    <div 
      className={`card-base p-4 space-y-3 ${onSelect ? 'cursor-pointer hover:border-primary/50 active:scale-[0.98]' : ''} ${isSelected ? 'ring-2 ring-primary bg-indigo-50/50 dark:bg-indigo-900/20 border-primary' : ''}`}
      onClick={onSelect ? handleCardClick : undefined}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 flex items-start gap-3">
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              onClick={(e) => e.stopPropagation()} // Stop propagation to the card's onClick
              className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary mt-1 shrink-0 transition-colors"
            />
          )}
          <div className="flex-1">
             <div className="text-base font-bold text-slate-900 dark:text-white leading-tight">{title}</div>
          </div>
        </div>
        
        {status && (
          <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full shadow-sm ${status.colorClasses} whitespace-nowrap`}>
            {status.text}
          </span>
        )}
      </div>
      
      <div className={`grid grid-cols-2 gap-x-4 gap-y-2 text-sm ${onSelect ? 'pl-8' : ''}`}>
        {details.map((detail, index) => (
          <div key={index} className="overflow-hidden">
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">{detail.label}</p>
            <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{detail.value}</div>
          </div>
        ))}
      </div>

      {actions && (
        <div className="flex justify-end items-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-3 mt-2">
          {actions}
        </div>
      )}
    </div>
  );
};
