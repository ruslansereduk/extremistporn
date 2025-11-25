import { TopSearches } from '../components/TopSearches';
import { TimelineChart } from '../components/TimelineChart';
import { LastUpdate } from '../components/LastUpdate';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
    return (
        <div className="min-h-screen bg-[rgb(var(--bg-secondary))] p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-[rgb(var(--accent))] hover:underline mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Вернуться к поиску
                    </Link>
                    <h1 className="text-4xl font-bold flex items-center gap-3">
                        <BarChart3 className="h-10 w-10 text-[rgb(var(--accent))]" />
                        Аналитика и статистика
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <TopSearches />
                    <LastUpdate />
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <TimelineChart />
                </div>
            </div>
        </div>
    );
}
