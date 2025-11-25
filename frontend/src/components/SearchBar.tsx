import { Search } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface SearchResult {
    icon: React.ReactNode;
    label: string;
    description: string;
    link: string;
}

interface SearchBarProps {
    onSearch: (query: string) => void;
    searchResults?: SearchResult[];
}

export function SearchBar({ onSearch, searchResults = [] }: SearchBarProps) {
    const [searchValue, setSearchValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleChange = (value: string) => {
        setSearchValue(value);
        onSearch(value);
    };

    return (
        <div className="w-full max-w-3xl">
            {/* Fixed Search Input */}
            <div className="bg-[rgb(var(--bg-primary))] rounded-2xl shadow-lg border border-[rgb(var(--border))] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--border))]">
                    <Search className="w-5 h-5 text-[rgb(var(--text-secondary))] flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchValue}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder="Введите текст для проверки..."
                        className="flex-1 text-lg outline-none bg-transparent text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-secondary))]"
                    />
                </div>

                {/* Search Results - Below Input */}
                {searchValue && searchResults.length > 0 && (
                    <div className="max-h-96 overflow-y-auto bg-[rgb(var(--bg-secondary))]">
                        {searchResults.map((result, index) => (
                            <a
                                key={index}
                                href={result.link}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-[rgb(var(--bg-tertiary))] transition-colors border-b border-[rgb(var(--border))] last:border-b-0"
                            >
                                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                                    {result.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-[rgb(var(--text-primary))]">{result.label}</p>
                                    <p className="text-sm text-[rgb(var(--text-secondary))] truncate">{result.description}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
