
import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';

interface CalendarProps {
    displayDate?: Date;
    onMonthChange?: (date: Date) => void;
    selectedDate?: Date;
    onDateSelect?: (date: Date) => void;
}

const dayNames = ['TH 2', 'TH 3', 'TH 4', 'TH 5', 'TH 6', 'TH 7', 'CN'];

export const Calendar: React.FC<CalendarProps> = ({ displayDate, onMonthChange, selectedDate, onDateSelect }) => {
    const [currentDate, setCurrentDate] = useState(displayDate || new Date());

    useEffect(() => {
        if (displayDate) {
            setCurrentDate(displayDate);
        }
    }, [displayDate]);

    const changeMonth = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(1); // Avoids issues with month-end dates
        newDate.setMonth(newDate.getMonth() + amount);
        setCurrentDate(newDate);
        if (onMonthChange) {
            onMonthChange(newDate);
        }
    };

    const renderHeader = () => {
        return (
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">{ICONS.chevronLeft}</button>
                <h2 className="text-base md:text-xl font-bold">
                    {`Tháng ${currentDate.getMonth() + 1}, ${currentDate.getFullYear()}`}
                </h2>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">{ICONS.chevronRight}</button>
            </div>
        );
    };

    const renderDays = () => {
        return (
            <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-2">
                {dayNames.map(day => <div key={day} className="py-1">{day}</div>)}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const startDate = new Date(monthStart);
        
        // Adjust start date to be the Monday of the first week
        const dayOffset = (monthStart.getDay() + 6) % 7; // Monday is 0, Sunday is 6
        startDate.setDate(startDate.getDate() - dayOffset);
        
        const rows = [];
        let day = new Date(startDate);
        const today = new Date();
        today.setHours(0,0,0,0);

        // Loop until we have filled at least 5 rows and have passed the end of the month
        while (day <= monthEnd || (rows.length < 5 && day.getMonth() === monthStart.getMonth()) || rows.length < 5) {
             const days = [];
             for (let i = 0; i < 7; i++) {
                const cloneDay = new Date(day);
                const isCurrentMonth = cloneDay.getMonth() === currentDate.getMonth();
                const isToday = cloneDay.getTime() === today.getTime();
                const isSelected = selectedDate ? (
                    cloneDay.getFullYear() === selectedDate.getFullYear() &&
                    cloneDay.getMonth() === selectedDate.getMonth() &&
                    cloneDay.getDate() === selectedDate.getDate()
                ) : false;

                days.push(
                    <div key={cloneDay.toISOString()} className="relative flex justify-center items-center py-2 h-12">
                         <button
                            onClick={() => onDateSelect && onDateSelect(cloneDay)}
                            className={`w-8 h-8 flex flex-col items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                isSelected ? 'bg-primary text-white' : 
                                isCurrentMonth ? 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700' : 'text-gray-400 dark:text-gray-600'
                            }`}
                        >
                            {cloneDay.getDate()}
                        </button>
                        {isToday && (
                            <span className="absolute bottom-1 w-4 h-0.5 bg-primary rounded-full"></span>
                        )}
                    </div>
                );
                day.setDate(day.getDate() + 1);
            }
            rows.push(<div key={day.toISOString()} className="grid grid-cols-7">{days}</div>);
            if (day > monthEnd && day.getDay() === 1) break;
        }
        return <div>{rows}</div>;
    };


    return (
        <div className="p-2 md:p-4">
            {renderHeader()}
            {renderDays()}
            {renderCells()}
        </div>
    );
};
