import React from 'react';
import { Link } from 'react-router-dom';

interface CardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement<{ className?: string }>;
  color: string; // Now a text color class, e.g., 'text-blue-600'
  linkTo?: string;
  linkState?: object;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ title, value, icon, color, linkTo, linkState, onClick }) => {
  const isInteractive = !!(linkTo || onClick);
  
  const content = (
    <div className={`card-base flex items-center p-4 ${isInteractive ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-200 group' : ''}`}
      onClick={onClick}
    >
      <div className={`mr-4 ${color} ${isInteractive ? 'group-hover:scale-110 transition-transform duration-200' : ''}`}>
        {React.cloneElement(icon, { className: `w-8 h-8 ${icon.props.className || ''}`.trim() })}
      </div>
      <div className="overflow-hidden flex-1">
        <p className={`text-sm font-medium text-slate-700 dark:text-slate-300 truncate ${isInteractive ? 'group-hover:text-primary transition-colors' : ''}`}>{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-white truncate">{value}</p>
      </div>
      {isInteractive && (
        <div className="ml-2 text-slate-300 dark:text-slate-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo} state={linkState} className="block">{content}</Link>;
  }
  
  return content;
};