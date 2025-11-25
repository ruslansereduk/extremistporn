import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';

interface TimelineData {
    year: string;
    count: number;
}

export function TimelineChart() {
    const [timeline, setTimeline] = useState<TimelineData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/timeline')
            .then(res => res.json())
            .then(data => {
                setTimeline(data.timeline || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch timeline:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-4">Загрузка...</div>;
    }

    return (
        <div className="bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg p-6 border border-[rgb(var(--border))]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-[rgb(var(--accent))]" />
                Динамика добавления материалов
            </h2>
            {timeline.length === 0 ? (
                <p className="text-[rgb(var(--text-secondary))]">Нет данных для отображения</p>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                        <XAxis dataKey="year" stroke="rgb(var(--text-secondary))" />
                        <YAxis stroke="rgb(var(--text-secondary))" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgb(var(--bg-secondary))',
                                border: '1px solid rgb(var(--border))',
                                color: 'rgb(var(--text-primary))'
                            }}
                        />
                        <Bar dataKey="count" fill="rgb(var(--accent))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
