import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

interface TopSearch {
    query: string;
    count: number;
    last_searched: string;
}

export function TopSearches() {
    const [topSearches, setTopSearches] = useState<TopSearch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/top-searches')
            .then(res => res.json())
            .then(data => {
                setTopSearches(data.topSearches || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch top searches:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-4">Загрузка...</div>;
    }

    return (
        <div className="bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg p-6 border border-[rgb(var(--border))]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[rgb(var(--accent))]" />
                Топ-10 запросов
            </h2>
            {topSearches.length === 0 ? (
                <p className="text-[rgb(var(--text-secondary))]">Пока нет данных</p>
            ) : (
                <div className="space-y-2">
                    {topSearches.map((search, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-secondary))] hover:bg-[rgb(var(--bg-tertiary))] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-[rgb(var(--text-secondary))] font-bold text-sm w-6">{index + 1}</span>
                                <span className="font-medium">{search.query}</span>
                            </div>
                            <span className="text-[rgb(var(--text-secondary))] text-sm">{search.count} раз</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
