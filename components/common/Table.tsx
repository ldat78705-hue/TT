import React from 'react';

export interface SortConfig<T> {
  key: keyof T;
  direction: 'ascending' | 'descending';
}

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  sortable?: boolean;
  sortKey?: keyof T; // Key to use for sorting if accessor is a function
}

interface TableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  actions?: (item: T) => React.ReactNode;
  sortConfig: SortConfig<T> | null;
  onSort: (key: keyof T) => void;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  fullDataIds?: string[];
}

export function Table<T extends { id: string }>({ columns, data, actions, sortConfig, onSort, selectedIds, onSelectionChange, fullDataIds }: TableProps<T>) {
  if (!data || data.length === 0) {
    return (
      <div className="card-base text-center text-gray-500 dark:text-gray-400">
        <h3 className="text-lg font-semibold">Không có dữ liệu</h3>
        <p className="mt-1">Hiện chưa có thông tin nào để hiển thị.</p>
      </div>
    );
  }

  const renderSortArrow = (key: keyof T) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>;
  };
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelectionChange) {
      const allIds = fullDataIds || data.map(item => item.id);
      const newSelectedIds = e.target.checked ? allIds : [];
      onSelectionChange(newSelectedIds);
    }
  };

  const handleSelectOne = (id: string) => {
    if (onSelectionChange && selectedIds) {
      const newSelectedIds = selectedIds.includes(id)
        ? selectedIds.filter(itemId => itemId !== id)
        : [...selectedIds, id];
      onSelectionChange(newSelectedIds);
    }
  };

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, id: string) => {
    if (onSelectionChange) {
        // Prevent row click from triggering if a button, link, or input inside the row was clicked
        if (e.target instanceof HTMLElement && e.target.closest('a, button, input')) {
            return;
        }
        handleSelectOne(id);
    }
  };
  
  const totalSelectableCount = fullDataIds ? fullDataIds.length : data.length;
  const isAllSelected = selectedIds && totalSelectableCount > 0 && selectedIds.length === totalSelectableCount;

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            {onSelectionChange && (
              <th scope="col" className="relative px-6 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </th>
            )}
            {columns.map((col, index) => {
              const sortableKey = col.sortKey || (typeof col.accessor === 'string' ? col.accessor as keyof T : undefined);
              return (
                <th
                  key={index}
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${col.sortable && sortableKey ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700' : ''}`}
                  onClick={() => col.sortable && sortableKey && onSort(sortableKey)}
                >
                  <div className="flex items-center">
                    {col.header}
                    {col.sortable && sortableKey && renderSortArrow(sortableKey)}
                  </div>
                </th>
              );
            })}
            {actions && <th scope="col" className="relative px-6 py-3"><span className="sr-only">Hành động</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => (
            <tr 
              key={item.id} 
              onClick={(e) => handleRowClick(e, item.id)}
              className={`transition-colors duration-150 ${onSelectionChange ? 'cursor-pointer' : ''} ${selectedIds?.includes(item.id) ? 'bg-indigo-50 dark:bg-slate-700' : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/50'}`}
            >
              {onSelectionChange && selectedIds && (
                 <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => handleSelectOne(item.id)}
                    />
                 </td>
              )}
              {columns.map((col, index) => (
                <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                  {typeof col.accessor === 'function'
                    ? col.accessor(item)
                    : (item[col.accessor] as React.ReactNode)}
                </td>
              ))}
              {actions && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-4">
                    {actions(item)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}