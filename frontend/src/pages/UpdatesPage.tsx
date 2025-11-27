import { useState, useEffect } from 'react';
import { triggerUpdate, fetchUpdateStatus, fetchUpdateHistory } from '../lib/api';
import { RefreshCw, CheckCircle, XCircle, Clock, FileText, AlertCircle, XCircleIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpdateHistoryItem {
    id: number;
    source_id: string;
    source_name: string;
    status: 'running' | 'success' | 'error' | 'cancelled';
    started_at: string;
    completed_at?: string;
    items_added: number;
    items_total: number;
    error_message?: string;
}

interface NewItem {
    content: string;
    court_decision: string;
}

export default function UpdatesPage() {
    const navigate = useNavigate();
    const [updating, setUpdating] = useState(false);
    const [status, setStatus] = useState<any>(null);
    const [history, setHistory] = useState<UpdateHistoryItem[]>([]);
    const [newItems, setNewItems] = useState<NewItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const loadStatus = async () => {
        try {
            const statusData = await fetchUpdateStatus();
            setStatus(statusData);

            // Parse new items from error_message field (used as JSON storage)
            if (statusData.status === 'success' && statusData.error_message) {
                try {
                    const items = JSON.parse(statusData.error_message);
                    setNewItems(items);
                } catch (e) {
                    console.error('Failed to parse new items:', e);
                }
            }

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
            const interval = setInterval(loadStatus, 3000);
            return () => clearInterval(interval);
        }
    }, [updating]);

    const handleTriggerUpdate = async () => {
        setError(null);
        setNewItems([]);
        try {
            await triggerUpdate();
            setUpdating(true);
            loadStatus();
            setTimeout(loadHistory, 1000);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleCancelUpdate = async () => {
        try {
            const response = await fetch('/api/admin/update/cancel', { method: 'POST' });
            if (response.ok) {
                loadStatus();
                loadHistory();
            }
        } catch (err) {
            console.error('Failed to cancel update:', err);
        }
    };

    const handleViewDetails = (item: UpdateHistoryItem) => {
        // Parse new items from this update
        if (item.status === 'success' && item.error_message) {
            try {
                const items = JSON.parse(item.error_message);
                setNewItems(items);
            } catch (e) {
                console.error('Failed to parse items:', e);
                setNewItems([]);
            }
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
            case 'cancelled':
                return <XCircleIcon className="h-5 w-5 text-gray-500" />;
            default:
                return null;
        }
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return 'N/A';
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
        <div className="min-h-screen bg-[rgb(var(--bg-secondary))] p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-[rgb(var(--text-primary))]">
                            🔄 Управление обновлениями
                        </h1>
                        <p className="text-[rgb(var(--text-secondary))] mt-2">
                            Обновление данных из государственных источников
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/admin')}
                        className="px-4 py-2 bg-[rgb(var(--bg-primary))] border border-[rgb(var(--border))] rounded-lg hover:bg-[rgb(var(--bg-tertiary))]"
                    >
                        ← Назад
                    </button>
                </div>

                {/* Current Status Card */}
                <div className="bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg border border-[rgb(var(--border))] p-6 mb-8">
                    <h2 className="text-xl font-bold mb-4">Текущий статус</h2>

                    <div className="flex items-center justify-between mb-6 p-4 bg-[rgb(var(--bg-secondary))] rounded-lg border border-[rgb(var(--border))]">
                        <div className="flex items-center gap-3">
                            {status?.status && getStatusIcon(status.status)}
                            <div>
                                <div className="font-medium text-lg">
                                    {status?.status === 'running' && 'Идет обновление...'}
                                    {status?.status === 'success' && 'Последнее обновление успешно'}
                                    {status?.status === 'error' && 'Ошибка обновления'}
                                    {status?.status === 'cancelled' && 'Обновление отменено'}
                                    {status?.status === 'idle' && 'Ожидание'}
                                </div>
                                {status?.completed_at && (
                                    <div className="text-sm text-[rgb(var(--text-secondary))]">
                                        {formatDate(status.completed_at)}
                                    </div>
                                )}
                            </div>
                        </div>
                        {status?.items_added !== undefined && status?.status === 'success' && (
                            <div className="text-right">
                                <div className="text-2xl font-bold text-green-600">
                                    +{status.items_added}
                                </div>
                                <div className="text-sm text-[rgb(var(--text-secondary))]">
                                    новых записей
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={handleTriggerUpdate}
                            disabled={updating}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${updating
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            <RefreshCw className={`h-5 w-5 ${updating ? 'animate-spin' : ''}`} />
                            {updating ? 'Обновление...' : 'Запустить обновление'}
                        </button>
                        {updating && (
                            <button
                                onClick={handleCancelUpdate}
                                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                            >
                                Отменить
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 border border-red-400 rounded text-red-700 text-sm flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            {error}
                        </div>
                    )}
                </div>

                {/* New Items Display */}
                {newItems.length > 0 && (
                    <div className="bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg border border-[rgb(var(--border))] p-6 mb-8">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Новые материалы ({newItems.length})
                        </h2>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {newItems.map((item, index) => (
                                <div
                                    key={index}
                                    className="p-4 bg-[rgb(var(--bg-secondary))] rounded-lg border border-[rgb(var(--border))]"
                                >
                                    <div className="text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
                                        {item.content}
                                    </div>
                                    <div className="text-xs text-[rgb(var(--text-secondary))]">
                                        Решение: {item.court_decision}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* History */}
                {history.length > 0 && (
                    <div className="bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg border border-[rgb(var(--border))] p-6">
                        <h2 className="text-xl font-bold mb-4">История обновлений</h2>
                        <div className="space-y-2">
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between p-4 bg-[rgb(var(--bg-secondary))] rounded-lg border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-tertiary))] cursor-pointer transition-colors"
                                    onClick={() => handleViewDetails(item)}
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        {getStatusIcon(item.status)}
                                        <div>
                                            <div className="font-medium text-[rgb(var(--text-primary))]">
                                                {item.source_name}
                                            </div>
                                            <div className="text-sm text-[rgb(var(--text-secondary))]">
                                                {formatDate(item.started_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {item.status === 'success' && (
                                            <div className="text-green-600 font-bold text-lg">
                                                +{item.items_added}
                                            </div>
                                        )}
                                        {item.status === 'error' && (
                                            <div className="text-red-500 text-sm">
                                                Ошибка
                                            </div>
                                        )}
                                        {item.status === 'cancelled' && (
                                            <div className="text-gray-500 text-sm">
                                                Отменено
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
