import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

interface UpdateInfo {
    timestamp: string;
    items_added: number;
    total_items: number;
}

export function LastUpdate() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/last-update')
            .then(res => res.json())
            .then(data => {
                setUpdateInfo(data.lastUpdate);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch last update:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-4">Загрузка...</div>;
    }

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg p-6 border border-[rgb(var(--border))]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-[rgb(var(--accent))]" />
                Последнее обновление
            </h2>
            {!updateInfo ? (
                <div className="text-[rgb(var(--text-secondary))]">
                    <p>Автоматические обновления еще не выполнялись</p>
                    <p className="text-sm mt-2">Система будет обновляться каждые 3 дня</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[rgb(var(--text-secondary))]">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(updateInfo.timestamp)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[rgb(var(--bg-secondary))] p-4 rounded-lg">
                            <p className="text-sm text-[rgb(var(--text-secondary))]">Добавлено</p>
                            <p className="text-2xl font-bold text-[rgb(var(--accent))]">{updateInfo.items_added}</p>
                        </div>
                        <div className="bg-[rgb(var(--bg-secondary))] p-4 rounded-lg">
                            <p className="text-sm text-[rgb(var(--text-secondary))]">Всего материалов</p>
                            <p className="text-2xl font-bold">{updateInfo.total_items.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
