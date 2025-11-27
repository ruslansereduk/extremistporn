import { useState, useEffect } from 'react';
import { fetchStats, fetchSources, fetchTopSearches, fetchRecentMaterials, fetchTimeline, fetchVisitorStats } from '../lib/api';
import StatsCard from '../components/StatsCard';
import { Database, FileText, Search, Clock, Users, Smartphone, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface VisitorStats {
    uniqueVisitors: {
        today: number;
        week: number;
    };
    devices: Array<{ device_type: string; count: number }>;
    referrers: Array<{ source: string; count: number }>;
}

export default function Analytics() {
    const [stats, setStats] = useState<any>(null);
    const [topSearches, setTopSearches] = useState<any[]>([]);
    const [recent, setRecent] = useState<any[]>([]);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [statsData, , searchesData, recentData, timelineData, visitorsData] = await Promise.all([
                    fetchStats(),
                    fetchSources(),
                    fetchTopSearches(),
                    fetchRecentMaterials(),
                    fetchTimeline(),
                    fetchVisitorStats()
                ]);

                setStats(statsData);
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

                {/* Link to Updates Page */}
                <div className="mb-8">
                    <div className="bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg border border-[rgb(var(--border))] p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold mb-2">🔄 Управление обновлениями</h2>
                                <p className="text-[rgb(var(--text-secondary))]">
                                    Обновление данных из государственных источников
                                </p>
                            </div>
                            <button
                                onClick={() => window.location.href = '/admin/updates'}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Открыть →
                            </button>
                        </div>
                    </div>
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
                                        {visitorStats?.devices.map((_entry, index) => (
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

                {/* Timeline Chart */}
                <div className="bg-[rgb(var(--bg-primary))] p-6 rounded-xl shadow-lg border border-[rgb(var(--border))] mb-8">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Clock className="h-5 w-5" /> Хронология материалов
                    </h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeline}>
                                <XAxis dataKey="year" stroke="rgb(var(--text-secondary))" />
                                <YAxis stroke="rgb(var(--text-secondary))" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border))' }}
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Top Searches */}
                    <div className="bg-[rgb(var(--bg-primary))] p-6 rounded-xl shadow-lg border border-[rgb(var(--border))]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Search className="h-5 w-5" /> Популярные запросы
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[rgb(var(--border))]">
                                        <th className="text-left py-3 px-4 font-medium text-[rgb(var(--text-secondary))]">Запрос</th>
                                        <th className="text-right py-3 px-4 font-medium text-[rgb(var(--text-secondary))]">Кол-во</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topSearches.map((search, i) => (
                                        <tr key={i} className="border-b border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-secondary))]">
                                            <td className="py-3 px-4 font-medium">{search.query}</td>
                                            <td className="py-3 px-4 text-right">{search.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent Materials */}
                    <div className="bg-[rgb(var(--bg-primary))] p-6 rounded-xl shadow-lg border border-[rgb(var(--border))]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Clock className="h-5 w-5" /> Недавние добавления
                        </h2>
                        <div className="space-y-4">
                            {recent.slice(0, 5).map((item) => (
                                <div key={item.id} className="p-4 rounded-lg bg-[rgb(var(--bg-secondary))] border border-[rgb(var(--border))]">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-mono bg-[rgb(var(--bg-primary))] px-2 py-1 rounded">#{item.id}</span>
                                    </div>
                                    <p className="text-sm line-clamp-2 mb-2">{item.content}</p>
                                    <p className="text-xs text-[rgb(var(--text-secondary))] line-clamp-1">{item.court_decision}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
