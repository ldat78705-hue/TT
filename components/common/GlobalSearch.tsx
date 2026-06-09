
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../hooks/useDataContext';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchResult } from '../../types';
import { ICONS } from '../../constants';

const removeAccents = (str: string) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
};

const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    if (!query || !text) return <>{text}</>;
    const sanitizedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${sanitizedQuery})`, 'gi'));
    return (
        <span>
            {parts.map((part, i) =>
                removeAccents(part.toLowerCase()) === removeAccents(query.toLowerCase()) ? (
                    <span key={i} className="font-bold text-primary">{part}</span>
                ) : (
                    part
                )
            )}
        </span>
    );
};

export const GlobalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const debouncedQuery = useDebounce(query, 300);
    const { state } = useData();
    const navigate = useNavigate();
    const searchRef = useRef<HTMLDivElement>(null);

    const handleResultClick = React.useCallback((path: string) => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        navigate(path);
    }, [navigate]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults([]);
            return;
        }

        const lowerQuery = debouncedQuery.toLowerCase();
        const normalizedQuery = removeAccents(lowerQuery);
        const foundResults: SearchResult[] = [];

        // Search Students
        state.students.forEach(s => {
            const normalizedName = removeAccents(s.name.toLowerCase());
            if (normalizedName.includes(normalizedQuery) || s.phone.includes(debouncedQuery) || s.id.toLowerCase().includes(lowerQuery)) {
                // Find enrolled classes
                const enrolledClassNames = state.classes
                    .filter(c => c.studentIds.includes(s.id))
                    .map(c => c.name)
                    .join(', ');

                const contextInfo = enrolledClassNames 
                    ? `Lớp: ${enrolledClassNames}` 
                    : `Phụ huynh: ${s.parentName}`;

                foundResults.push({ 
                    id: s.id, 
                    name: s.name, 
                    type: 'student', 
                    path: `/student/${s.id}`, 
                    context: contextInfo 
                });
            }
        });

        // Search Teachers
        state.teachers.forEach(t => {
            const normalizedName = removeAccents(t.name.toLowerCase());
            const normalizedSubject = removeAccents(t.subject.toLowerCase());
            if (normalizedName.includes(normalizedQuery) || normalizedSubject.includes(normalizedQuery)) {
                foundResults.push({ id: t.id, name: t.name, type: 'teacher', path: `/teacher/${t.id}`, context: `Môn: ${t.subject}` });
            }
        });

        // Search Classes
        state.classes.forEach(c => {
            const normalizedName = removeAccents(c.name.toLowerCase());
            if (normalizedName.includes(normalizedQuery)) {
                const teacherNames = (c.teacherIds || [])
                    .map(teacherId => state.teachers.find(t => t.id === teacherId)?.name)
                    .filter(name => !!name)
                    .join(', ');
                foundResults.push({ id: c.id, name: c.name, type: 'class', path: `/class/${c.id}`, context: `GV: ${teacherNames || 'N/A'}` });
            }
        });

        setResults(foundResults.slice(0, 10)); // Limit results
        setActiveIndex(-1);
    }, [debouncedQuery, state.students, state.teachers, state.classes]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen || results.length === 0) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (activeIndex >= 0 && activeIndex < results.length) {
                        handleResultClick(results[activeIndex].path);
                    }
                    break;
                case 'Escape':
                    setIsOpen(false);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, activeIndex, handleResultClick]);


    return (
        <div className="relative w-full max-w-xs" ref={searchRef}>
            <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    {ICONS.search}
                </span>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Tìm kiếm học viên, lớp học..."
                    className="form-input w-full py-2 pl-10 pr-4"
                />
            </div>

            {isOpen && query.length > 1 && (
                <div className="absolute z-10 w-full mt-2 bg-white rounded-md shadow-lg dark:bg-gray-800 border dark:border-gray-700 max-h-96 overflow-y-auto">
                    {results.length > 0 ? (
                        <ul>
                            {results.map((result, index) => (
                                <li key={`${result.type}-${result.id}`}
                                    onClick={() => handleResultClick(result.path)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={`px-4 py-3 cursor-pointer border-b dark:border-gray-700 last:border-b-0
                                        ${index === activeIndex ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`
                                    }>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200"><HighlightMatch text={result.name} query={debouncedQuery} /></p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{result.context}</p>
                                </li>
                            ))}
                        </ul>
                    ) : debouncedQuery.length > 1 ? (
                        <div className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">Không tìm thấy kết quả.</div>
                    ) : null}
                </div>
            )}
        </div>
    );
};
