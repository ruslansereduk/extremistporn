import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBar } from './components/SearchBar';
import { FileText, Gavel, AlertTriangle, ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeToggle } from './components/ThemeToggle';
import { Dashboard } from './pages/Dashboard';
import Analytics from './pages/Analytics';
import UpdatesPage from './pages/UpdatesPage';
import { fetchMaterial, searchMaterials, fetchStats } from './lib/api';

interface Material {
    id: number;
    content: string;
    court_decision: string;
    snippet?: string;
}

interface SearchResult {
    icon: React.ReactNode;
    label: string;
    description: string;
    link: string;
}

function SearchPage() {
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Handle URL params for direct profile access
    useEffect(() => {
        const id = searchParams.get('id');
        if (id) {
            _fetchMaterial(id);
        }

        // Fetch stats
        fetchStats().then((data: { total: number }) => setTotalCount(data.total)).catch(console.error);
    }, [searchParams]);

    const _fetchMaterial = async (id: string) => {
        setLoading(true);
        try {
            const data = await fetchMaterial(id);
            setSelectedMaterial(data);
        } catch (error) {
            console.error('Error fetching material:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setSearchPerformed(false);
            return;
        }

        try {
            const results = await searchMaterials(query);
            const formattedResults: SearchResult[] = results.map((item: Material) => ({
                icon: <FileText className="text-red-500" />,
                label: `Материал #${item.id}`,
                description: item.snippet ? item.snippet.replace(/<[^>]*>/g, '') : item.content.substring(0, 100) + '...',
                link: `?id=${item.id}`
            }));
            setSearchResults(formattedResults);
            setSearchPerformed(true);
        } catch (error) {
            console.error('Search error:', error);
            setSearchPerformed(true);
        }
    };

    if (selectedMaterial) {
        return (
            <ErrorBoundary fallback={<p>Something went wrong while displaying the material.</p>}>
                <div className="min-h-screen bg-[rgb(var(--bg-secondary))] p-8 font-sans">
                    <div className="max-w-3xl mx-auto bg-[rgb(var(--bg-primary))] rounded-xl shadow-lg p-8 border border-[rgb(var(--border))]">
                        <button
                            onClick={() => {
                                setSelectedMaterial(null);
                                navigate('/');
                            }}
                            className="flex items-center text-[rgb(var(--accent))] hover:underline mb-6 font-medium"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Вернуться к поиску
                        </button>

                        {loading ? (
                            <p>Загрузка...</p>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 mb-6 border-b border-[rgb(var(--border))] pb-4">
                                    <AlertTriangle className="h-8 w-8 text-red-500" />
                                    <h1 className="text-2xl font-bold">Экстремистский материал #{selectedMaterial.id}</h1>
                                </div>

                                <div className="mb-8">
                                    <h2 className="text-sm uppercase tracking-wide text-[rgb(var(--text-secondary))] font-semibold mb-2 flex items-center gap-2">
                                        <FileText className="h-4 w-4" /> Описание
                                    </h2>
                                    <div className="bg-[rgb(var(--bg-secondary))] p-4 rounded-lg border border-[rgb(var(--border))] text-lg leading-relaxed">
                                        {selectedMaterial.content}
                                    </div>
                                </div>

                                <div>
                                    <h2 className="text-sm uppercase tracking-wide text-[rgb(var(--text-secondary))] font-semibold mb-2 flex items-center gap-2">
                                        <Gavel className="h-4 w-4" /> Решение суда
                                    </h2>
                                    <div className="bg-[rgb(var(--bg-secondary))] p-4 rounded-lg border-2 border-red-600 font-medium">
                                        {selectedMaterial.court_decision}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </ErrorBoundary>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[rgb(var(--bg-secondary))] to-[rgb(var(--bg-tertiary))] flex flex-col items-center justify-center p-4">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>

            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Проверка материалов</h1>
                <p className="text-[rgb(var(--text-secondary))] text-lg mb-2">Поиск по республиканскому списку экстремистских материалов</p>
                {totalCount != null && (
                    <p className="text-[rgb(var(--text-secondary))] text-sm">Всего материалов в базе: <span className="font-semibold">{(totalCount || 0).toLocaleString()}</span></p>
                )}
            </div>

            {searchPerformed && (
                <div className={`w-full max-w-3xl mb-6 p-4 rounded-lg shadow-lg flex items-center gap-3 border-2 ${searchResults.length > 0
                    ? 'bg-[rgb(var(--bg-primary))] border-red-600'
                    : 'bg-[rgb(var(--bg-primary))] border-green-600'
                    }`}>
                    {searchResults.length > 0 ? (
                        <>
                            <AlertTriangle className="text-red-600 dark:text-red-400 w-8 h-8 flex-shrink-0" />
                            <div>
                                <p className="text-[rgb(var(--text-primary))] font-bold text-lg">Найдено в списке экстремистских материалов</p>
                                <p className="text-[rgb(var(--text-secondary))] text-sm">Найдено совпадений: {searchResults.length}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-xl">✓</span>
                            </div>
                            <div>
                                <p className="text-[rgb(var(--text-primary))] font-bold text-lg">Не найдено в списке экстремистских материалов</p>
                                <p className="text-[rgb(var(--text-secondary))] text-sm">Контент не относится к экстремистским</p>
                            </div>
                        </>
                    )}
                </div>
            )}

            <SearchBar
                onSearch={handleSearch}
                searchResults={searchResults}
            />
        </div>
    );
}

function App() {
    return (
        <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Analytics />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/updates" element={<UpdatesPage />} />
        </Routes>
    );
}

export default App;

