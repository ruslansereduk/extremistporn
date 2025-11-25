import React, { useEffect, useState } from 'react';
import { FileText, Calendar, Database, Search } from 'lucide-react';
import StatsCard from '../components/StatsCard';

interface AnalyticsStats {
    totalMaterials: number;
    totalSources: number;
    processedFiles: number;
    lastUpdate: {
        date: string;
        recordsAdded: number;
    } | null;
    searches: {
        total: number;
        today: number;
    };
}

interface Source {
    filename: string;
    file_hash: string;
    processed_at: string;
    records_count: number;
    currentCount: number;
}

interface TopSearch {
    query: string;
    count: number;
    last_searched: string;
}

interface TimelineEntry {
    year: string;
    count: number;
}

const Analytics: React.FC = () => {
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [sources, setSources] = useState<Source[]>([]);
    const [topSearches, setTopSearches] = useState<TopSearch[]>([]);
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);

            // Fetch all analytics data in parallel
            const [statsRes, sourcesRes, searchesRes, timelineRes] = await Promise.all([
                fetch('/api/admin/analytics/stats'),
                fetch('/api/admin/analytics/sources'),
                fetch('/api/analytics/top-searches'),
                fetch('/api/admin/analytics/timeline')
            ]);

            if (!statsRes.ok || !sourcesRes.ok || !searchesRes.ok || !timelineRes.ok) {
                throw new Error('Failed to fetch analytics data');
            }

            const [statsData, sourcesData, searchesData, timelineData] = await Promise.all([
                statsRes.json(),
                sourcesRes.json(),
                searchesRes.json(),
                timelineRes.json()
            ]);

            setStats(statsData);
            setSources(sourcesData.sources);
            setTopSearches(searchesData.topSearches);
            setTimeline(timelineData.timeline);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
                    <p className="font-medium">Ошибка загрузки аналитики</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <Database className="w-8 h-8" />
                    Аналитика
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Статистика и аналитика базы данных
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatsCard
                    title="Всего записей"
                    value={stats?.totalMaterials || 0}
                    icon="chart"
                    loading={loading}
                />
                <StatsCard
                    title="Источников файлов"
                    value={stats?.processedFiles || 0}
                    subtitle={`${stats?.totalSources || 0} уникальных`}
                    icon="chart"
                    loading={loading}
                />
                <StatsCard
                    title="Всего поисков"
                    value={stats?.searches.total || 0}
                    subtitle={`${stats?.searches.today || 0} сегодня`}
                    icon="trending"
                    loading={loading}
                />
                <StatsCard
                    title="Последнее обновление"
                    value={stats?.lastUpdate?.recordsAdded || 0}
                    subtitle={stats?.lastUpdate ? formatDate(stats.lastUpdate.date) : 'Нет данных'}
                    icon="alert"
                    loading={loading}
                />
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Sources Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5" />
                            Обработанные файлы
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Файл</th>
                                        <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Записей</th>
                                        <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Дата</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={3} className="py-8 text-center text-gray-500">
                                                Загрузка...
                                            </td>
                                        </tr>
                                    ) : sources.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="py-8 text-center text-gray-500">
                                                Нет данных
                                            </td>
                                        </tr>
                                    ) : (
                                        sources.map((source, idx) => (
                                            <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="py-3 px-2 text-gray-900 dark:text-white truncate max-w-xs" title={source.filename}>
                                                    {source.filename.substring(0, 20)}...
                                                </td>
                                                <td className="py-3 px-2 text-right text-gray-900 dark:text-white font-mono">
                                                    {source.currentCount.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-400 text-xs">
                                                    {new Date(source.processed_at).toLocaleDateString('ru-RU')}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Top Searches */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                            <Search className="w-5 h-5" />
                            Популярные поиски
                        </h2>
                        <div className="space-y-3">
                            {loading ? (
                                <p className="text-center text-gray-500 py-8">Загрузка...</p>
                            ) : topSearches.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Нет данных</p>
                            ) : (
                                topSearches.map((search, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                                        <div className="flex-1">
                                            <p className="text-gray-900 dark:text-white font-medium">
                                                {search.query}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Последний: {new Date(search.last_searched).toLocaleDateString('ru-RU')}
                                            </p>
                                        </div>
                                        <span className="ml-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
                                            {search.count}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                        <Calendar className="w-5 h-5" />
                        Распределение по годам
                    </h2>
                    <div className="space-y-3">
                        {loading ? (
                            <p className="text-center text-gray-500 py-8">Загрузка...</p>
                        ) : timeline.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">Нет данных</p>
                        ) : (
                            timeline.map((entry, idx) => {
                                const maxCount = Math.max(...timeline.map(t => t.count));
                                const percentage = (entry.count / maxCount) * 100;

                                return (
                                    <div key={idx} className="flex items-center gap-4">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-16">
                                            {entry.year}
                                        </span>
                                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-8 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full flex items-center justify-end px-3 transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                            >
                                                <span className="text-white text-sm font-medium">
                                                    {entry.count.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
