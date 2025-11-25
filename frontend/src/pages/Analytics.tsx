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
        const loadData = async () => {
            try {
                const [statsData, sourcesData, searchesData, recentData, timelineData, visitorsData] = await Promise.all([
                    fetchStats(),
                    fetchSources(),
                    fetchTopSearches(),
                    fetchRecentMaterials(),
                    fetchTimeline(),
                    fetchVisitorStats()
                ]);

                setStats(statsData);
                setSources(sourcesData.sources);
                setTopSearches(searchesData.topSearches);
                setRecent(recentData.recent);
                setTimeline(timelineData.timeline);
                setVisitorStats(visitorsData);
            } catch (error) {
                console.error('Failed to load analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    if (loading) {
        return (
            <div className="min-h-screen bg-[rgb(var(--bg-secondary))] p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[rgb(var(--bg-secondary))] p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-[rgb(var(--text-primary))]">Панель администратора</h1>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatsCard
                        title="Всего материалов"
                        value={stats?.totalMaterials || 0}
                        icon={<Database className="h-6 w-6 text-blue-500" />}
                        subtitle="Записей в базе"
                    />
                    <StatsCard
                        title="Файлов источников"
                        value={stats?.totalSources || 0}
                        icon={<FileText className="h-6 w-6 text-green-500" />}
                        subtitle="Обработано документов"
                    />
                    <StatsCard
                        title="Поисков сегодня"
                        value={stats?.searches?.today || 0}
                        icon={<Search className="h-6 w-6 text-purple-500" />}
                        subtitle={`Всего: ${stats?.searches?.total || 0}`}
                    />
                    <StatsCard
                        title="Посетителей (24ч)"
                        value={visitorStats?.uniqueVisitors?.today || 0}
                        icon={<Users className="h-6 w-6 text-orange-500" />}
                        subtitle={`За неделю: ${visitorStats?.uniqueVisitors?.week || 0}`}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Visitor Devices */}
                    <div className="bg-[rgb(var(--bg-primary))] p-6 rounded-xl shadow-lg border border-[rgb(var(--border))]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Smartphone className="h-5 w-5" /> Устройства
                        </h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={visitorStats?.devices}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="count"
                                        nameKey="device_type"
                                        label
                                    >
                                        {visitorStats?.devices.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border))' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Referrers */}
                    <div className="bg-[rgb(var(--bg-primary))] p-6 rounded-xl shadow-lg border border-[rgb(var(--border))]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Globe className="h-5 w-5" /> Источники переходов
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[rgb(var(--border))]">
                                        <th className="text-left py-3 px-4 font-medium text-[rgb(var(--text-secondary))]">Источник</th>
                                        <th className="text-right py-3 px-4 font-medium text-[rgb(var(--text-secondary))]">Визиты</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visitorStats?.referrers.map((ref, i) => (
                                        <tr key={i} className="border-b border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-secondary))]">
                                            <td className="py-3 px-4 font-medium">{ref.source}</td>
                                            <td className="py-3 px-4 text-right">{ref.count}</td>
                                        </tr>
                                    ))}
                                    {(!visitorStats?.referrers || visitorStats.referrers.length === 0) && (
                                        <tr>
                                            <td colSpan={2} className="py-4 text-center text-[rgb(var(--text-secondary))]">Нет данных</td>
                                        </tr>
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
