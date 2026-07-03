
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
            const target = event.target as Node;
            // Only handle click-outside for desktop dropdown (searchRef).
            // Mobile overlay is fullscreen with its own "Đóng" button — 
            // click-outside is not needed and causes race conditions on touch devices.
            if (
                searchRef.current &&
                searchRef.current.offsetParent !== null && // Only if desktop search is visible
                !searchRef.current.contains(target)
            ) {
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

        const lowerQuery = debouncedQuery.toLowerCase().trim();
        const normalizedQuery = removeAccents(lowerQuery);
        const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
        const foundResults: (SearchResult & { _score: number })[] = [];

        const getNameScore = (normalizedName: string) => {
            const nameParts = normalizedName.split(/\s+/);
            const lastName = nameParts[nameParts.length - 1] || '';

            // Exact last-name (tên gọi) match — highest priority
            if (queryWords.length === 1 && lastName === queryWords[0]) return 5;
            // Last name starts with query
            if (queryWords.length === 1 && lastName.startsWith(queryWords[0])) return 4;
            // All query words match parts of the name
            if (queryWords.every(w => normalizedName.includes(w))) return 3;
            // Single word partial match anywhere in name
            if (normalizedName.includes(normalizedQuery)) return 2;
            return 0;
        };

        // Search Students
        state.students.forEach(s => {
            const normalizedName = removeAccents(s.name.toLowerCase());
            const phoneMatch = (s.phone || '').includes(debouncedQuery.trim());
            const idMatch = s.id.toLowerCase().includes(lowerQuery);
            const nameScore = getNameScore(normalizedName);

            if (nameScore > 0 || phoneMatch || idMatch) {
                const enrolledClassNames = state.classes
                    .filter(c => c.studentIds.includes(s.id))
                    .map(c => c.name)
                    .join(', ');

                const contextInfo = enrolledClassNames 
                    ? `Lớp: ${enrolledClassNames}` 
                    : `Phụ huynh: ${s.parentName}`;

                const score = phoneMatch ? 6 : idMatch ? 1 : nameScore;

                foundResults.push({ 
                    id: s.id, 
                    name: s.name, 
                    type: 'student', 
                    path: `/student/${s.id}`, 
                    context: contextInfo,
                    _score: score
                });
            }
        });

        // Search Teachers
        state.teachers.forEach(t => {
            const normalizedName = removeAccents(t.name.toLowerCase());
            const normalizedSubject = removeAccents(t.subject.toLowerCase());
            const nameScore = getNameScore(normalizedName);
            const subjectMatch = queryWords.every(w => normalizedSubject.includes(w));

            if (nameScore > 0 || subjectMatch) {
                foundResults.push({ 
                    id: t.id, name: t.name, type: 'teacher', 
                    path: `/teacher/${t.id}`, context: `Môn: ${t.subject}`,
                    _score: nameScore > 0 ? nameScore : 1
                });
            }
        });

        // Search Classes
        state.classes.forEach(c => {
            const normalizedName = removeAccents(c.name.toLowerCase());
            const classMatch = queryWords.every(w => normalizedName.includes(w));
            if (classMatch) {
                const teacherNames = (c.teacherIds || [])
                    .map(teacherId => state.teachers.find(t => t.id === teacherId)?.name)
                    .filter(name => !!name)
                    .join(', ');
                foundResults.push({ 
                    id: c.id, name: c.name, type: 'class', 
                    path: `/class/${c.id}`, context: `GV: ${teacherNames || 'N/A'}`,
                    _score: 1
                });
            }
        });

        // Sort by score descending, then by name
        foundResults.sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            return a.name.localeCompare(b.name, 'vi');
        });

        setResults(foundResults.slice(0, 15)); // Increased limit
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
        <>
            {/* Desktop: inline search */}
            <div className="relative w-full max-w-xs hidden md:block" ref={searchRef}>
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

            {/* Mobile: icon button + overlay */}
            <button
                className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => { setIsOpen(true); setQuery(''); }}
                aria-label="Tìm kiếm"
            >
                {React.cloneElement(ICONS.search, { className: 'w-5 h-5' })}
            </button>

            {/* Mobile overlay */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col">
                    <div className="flex items-center gap-2 p-3 border-b dark:border-slate-700">
                        <span className="text-gray-400 flex-shrink-0">{ICONS.search}</span>
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Tìm kiếm học viên, lớp học..."
                            className="form-input flex-1 py-2"
                            autoFocus
                        />
                        <button
                            onClick={() => { setIsOpen(false); setQuery(''); }}
                            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium text-sm"
                        >
                            Đóng
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {results.length > 0 ? (
                            <ul>
                                {results.map((result, index) => (
                                    <li key={`mobile-${result.type}-${result.id}`}
                                        onClick={() => handleResultClick(result.path)}
                                        className={`px-4 py-3 border-b dark:border-gray-700 last:border-b-0 active:bg-gray-100 dark:active:bg-gray-700
                                            ${index === activeIndex ? 'bg-gray-100 dark:bg-gray-700' : ''}`
                                        }>
                                        <p className="font-semibold text-gray-800 dark:text-gray-200"><HighlightMatch text={result.name} query={debouncedQuery} /></p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{result.context}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : query.length > 1 && debouncedQuery.length > 1 ? (
                            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Không tìm thấy kết quả.</div>
                        ) : (
                            <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                                Nhập tên học viên, giáo viên hoặc lớp học để tìm kiếm...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
