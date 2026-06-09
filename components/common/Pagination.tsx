import React from 'react';
import { ICONS } from '../../constants';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      if (currentPage > 2) {
        pages.push(currentPage - 1);
      }
      if (currentPage !== 1 && currentPage !== totalPages) {
        pages.push(currentPage);
      }
      if (currentPage < totalPages - 1) {
        pages.push(currentPage + 1);
      }
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return [...new Set(pages)];
  };

  const pageNumbers = getPageNumbers();
  
  const pageButtonClass = (isActive: boolean) => 
    `px-3 py-1 mx-1 rounded-md text-sm transition-colors ${
      isActive
        ? 'bg-primary text-white shadow-sm'
        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
    }`;
  
  const iconButtonClass = (disabled: boolean) =>
     `p-2 rounded-md transition-colors ${
        disabled
         ? 'text-gray-400 cursor-not-allowed'
         : 'hover:bg-gray-100 dark:hover:bg-gray-600'
     }`;


  return (
    <div className="flex flex-col md:flex-row items-center justify-between mt-4 bg-white dark:bg-gray-800 px-4 py-3 rounded-b-lg border-t dark:border-gray-700">
      <span className="text-sm text-gray-700 dark:text-gray-400 mb-2 md:mb-0">
        Hiển thị {startItem}-{endItem} trên {totalItems}
      </span>
      <nav className="flex items-center">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={iconButtonClass(currentPage === 1)}>
            {ICONS.chevronLeft}
        </button>
        {pageNumbers.map((page, index) =>
          typeof page === 'number' ? (
            <button key={index} onClick={() => onPageChange(page)} className={pageButtonClass(currentPage === page)}>
              {page}
            </button>
          ) : (
            <span key={index} className="px-3 py-1 mx-1 text-sm text-gray-500">
              {page}
            </span>
          )
        )}
         <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={iconButtonClass(currentPage === totalPages)}>
            {ICONS.chevronRight}
        </button>
      </nav>
    </div>
  );
};