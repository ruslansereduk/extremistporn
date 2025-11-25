const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('results');

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    resultsContainer.innerHTML = '<p>Поиск...</p>';

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        displayResults(data.results);
    } catch (err) {
        console.error(err);
        resultsContainer.innerHTML = '<p style="color: red;">Ошибка при поиске</p>';
    }
}

function displayResults(results) {
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
        resultsContainer.innerHTML = '<p>Ничего не найдено.</p>';
        return;
    }

    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item';

        // Use snippet if available, otherwise content
        const contentHtml = item.snippet ? item.snippet : item.content;

        div.innerHTML = `
            <div class="result-content"><a href="/profile.html?id=${item.id}" class="result-link">${contentHtml}</a></div>
            <div class="result-court">${item.court_decision}</div>
        `;
        resultsContainer.appendChild(div);
    });
}

async function loadProfile(id) {
    const profileContent = document.getElementById('profile-content');
    if (!profileContent) return;

    try {
        const response = await fetch(`/api/materials/${id}`);
        if (!response.ok) throw new Error('Material not found');
        const material = await response.json();

        profileContent.innerHTML = `
            <h1>Экстремистский материал #${material.id}</h1>
            <div class="profile-section">
                <h2>Описание</h2>
                <div class="profile-text">${material.content}</div>
            </div>
            <div class="profile-section">
                <h2>Решение суда</h2>
                <div class="profile-court">${material.court_decision}</div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        profileContent.innerHTML = '<p style="color: red;">Ошибка загрузки профиля</p>';
    }
}

if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}
