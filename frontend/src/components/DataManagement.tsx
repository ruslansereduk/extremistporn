import { useState, useEffect } from 'react';
import { triggerUpdate, fetchUpdateStatus, fetchUpdateHistory } from '../lib/api';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

interface UpdateHistoryItem {
    id: number;
    source_id: string;
    source_name: string;
    status: 'running' | 'success' | 'error';
    started_at: string;
    completed_at?: string;
    items_added: number;
    error_message?: string;
}

export default function DataManagement() {
    const [updating, setUpdating] = useState(false);
    const [status, setStatus] = useState<any>(null);
    const [history, setHistory] = useState<UpdateHistoryItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const loadStatus = async () => {
        try {
            const statusData = await fetchUpdateStatus();
            setStatus(statusData);

            // If running, poll for updates
            if (statusData.status === 'running') {
                setUpdating(true);
            } else {
                setUpdating(false);
            }
        } catch (err) {
            console.error('Failed to load status:', err);
        }
    };

    const loadHistory = async () => {
        try {
            const historyData = await fetchUpdateHistory();
            setHistory(historyData.history || []);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    };

    useEffect(() => {
        loadStatus();
        loadHistory();
    }, []);

    // Poll status when updating
    useEffect(() => {
        if (updating) {
            const interval = setInterval(loadStatus, 3000); // Poll every 3 seconds
            return () => clearInterval(interval);
        }
    }, [updating]);

    const handleTriggerUpdate = async () => {
        setError(null);
        try {
            await triggerUpdate();
            setUpdating(true);
            loadStatus();
            // Refresh history after a moment
            setTimeout(loadHistory, 1000);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const getStatusIcon = (itemStatus: string) => {
        switch (itemStatus) {
            case 'running':
                return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'error':
                return <XCircle className="h-5 w-5 text-red-500" />;
            default:
                return null;
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg border border-[rgb(var(--border))] p-6">
            <h2 className="text-xl font-bold mb-4 text-[rgb(var(--text-primary))]">
                🔄 Управление данными
            </h2>

            {/* Current Status */}
            <div className="mb-6 p-4 bg-[rgb(var(--bg-secondary))] rounded-lg border border-[rgb(var(--border))]">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[rgb(var(--text-secondary))]">
                        Статус:
                    </span>
                    <div className="flex items-center gap-2">
                        {status?.status && getStatusIcon(status.status)}
                        <span className="text-sm font-medium">
                            {status?.status === 'running' && 'Обновление...'}
                            {status?.status === 'success' && 'Готово'}
                            {status?.status === 'error' && 'Ошибка'}
                            {status?.status === 'idle' && 'Ожидание'}
                        </span>
                    </div>
                </div>
                {status?.completed_at && (
                    <div className="text-xs text-[rgb(var(--text-secondary))]">
                        Последнее обновление: {formatDate(status.completed_at)}
                    </div>
                )}
                {status?.error_message && (
                    <div className="text-xs text-red-500 mt-2">
                        {status.error_message}
                    </div>
                )}
            </div>

            {/* Update Button */}
            <button
                onClick={handleTriggerUpdate}
                disabled={updating}
                className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${updating
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
            >
                <RefreshCw className={`h-5 w-5 ${updating ? 'animate-spin' : ''}`} />
                {updating ? 'Обновление...' : 'Обновить все данные'}
            </button>

            {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 rounded text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Update History */}
            {history.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-semibold mb-3 text-[rgb(var(--text-secondary))]">
                        История обновлений
                    </h3>
                    <div className="space-y-2">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-3 bg-[rgb(var(--bg-secondary))] rounded border border-[rgb(var(--border))] text-sm"
                            >
                                <div className="flex items-center gap-3">
                                    {getStatusIcon(item.status)}
                                    <div>
                                        <div className="font-medium text-[rgb(var(--text-primary))]">
                                            {item.source_name}
                                        </div>
                                        <div className="text-xs text-[rgb(var(--text-secondary))]">
                                            {formatDate(item.started_at)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {item.status === 'success' && (
                                        <div className="text-green-600 font-medium">
                                            +{item.items_added} записей
                                        </div>
                                    )}
                                    {item.status === 'error' && (
                                        <div className="text-red-500 text-xs">
                                            Ошибка
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
