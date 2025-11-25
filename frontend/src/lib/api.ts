export async function fetchMaterial(id: string) {
    const response = await fetch(`/api/materials/${id}`);
    if (!response.ok) {
        throw new Error('Failed to fetch material');
    }
    return await response.json();
}

export const fetchStats = async (): Promise<{ total: number }> => {
    const response = await fetch('/api/stats');
    if (!response.ok) {
        throw new Error('Failed to fetch stats');
    }
    return response.json();
};

export async function searchMaterials(query: string) {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error('Search request failed');
    }
    const data = await response.json();
    return data.results;
}
