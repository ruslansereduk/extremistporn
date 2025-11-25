# Extremist Materials Database

🔍 Поисковая система по республиканскому списку экстремистских материалов Республики Беларусь

## 📊 О проекте

Web-приложение для быстрого поиска и проверки материалов в официальном списке экстремистских материалов. База данных содержит **15,336 записей**, включая:

- 4,602 физических лица
- 318 организаций и формирований
- Полные данные о судебных решениях и датах включения

## ✨ Возможности

- 🔎 **Полнотекстовый поиск** через FTS5
- 📱 **Адаптивный дизайн** для mobile/desktop
- 🌓 **Dark/Light режимы**
- 📊 **Админ-панель** с аналитикой
- ⚡ **Быстрая обработка** - поиск за <100ms
- 🔄 **Автоматическое обновление** через batch processing

## 🚀 Технологии

**Backend:**
- Node.js + Express
- SQLite с FTS5 (full-text search)
- Better-sqlite3

**Frontend:**
- React + TypeScript  
- Vite
- Tailwind CSS
- Lucide icons

**Data Processing:**
- Custom parsers для .doc и .xlsx
- Автоматическая дедупликация
- Incremental updates

## 📦 Установка

```bash
# Клонировать репозиторий
git clone https://github.com/YOUR_USERNAME/extremistporn.git
cd extremistporn

# Установить зависимости
npm install
cd frontend && npm install && cd ..

# Собрать frontend
cd frontend && npm run build && cd ..

# Запустить сервер
npm start
```

## 🔧 Настройка для production

### Railway Deployment

1. **Создать проект в Railway**
```bash
railway login
railway init
```

2. **Добавить Volume для базы данных**
   - Railway Dashboard → Settings → Volumes
   - Mount Path: `/app/data`
   - Size: 1 GB

3. **Установить переменные окружения**
```
DB_PATH=/app/data/extremist_materials.db
NODE_ENV=production
PORT=3000
```

4. **Deploy**
```bash
railway up
```

### Обновление данных

```bash
# Поместить новые .doc/.xlsx файлы в папку Extrimists/
# Запустить batch processing
npm run batch-parse
```

## 📁 Структура проекта

```
extremistporn2/
├── backend/
│   ├── server.js           # Express server
│   ├── db.js              # Database initialization
│   ├── admin-routes.js    # Analytics API
│   └── scheduler.js       # Auto-update scheduler
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # Main app
│   │   ├── pages/
│   │   │   ├── Analytics.tsx
│   │   │   └── Dashboard.tsx
│   │   └── components/
│   └── dist/              # Build output
├── scripts/
│   └── batch_parse_docs.js  # Data parser
└── Extrimists/            # Source .doc/.xlsx files
```

## 🔐 API Endpoints

### Public
- `GET /api/search?q={query}` - Поиск материалов
- `GET /api/stats` - Общая статистика
- `GET /api/materials/:id` - Детали материала

### Admin
- `GET /api/admin/analytics/stats` - Общая аналитика
- `GET /api/admin/analytics/sources` - Статистика по файлам
- `GET /api/admin/analytics/timeline` - Timeline по годам
- `GET /api/analytics/top-searches` - Популярные запросы

## 📊 База данных

**SQLite schema:**
```sql
CREATE TABLE materials (
  id INTEGER PRIMARY KEY,
  content TEXT,              -- ФИО / Название организации
  court_decision TEXT,       -- Решение суда
  source_file TEXT          -- Источник данных
);

CREATE VIRTUAL TABLE materials_fts 
USING fts5(content, court_decision);
```

**Текущий размер:**  
- Records: 15,336
- Database: ~40 MB
- Sources: 5 files (.doc + .xlsx)

## 🛠️ Разработка

```bash
# Запустить dev server
npm run dev

# Frontend dev server (hot reload)
cd frontend && npm run dev

# Парсинг новых файлов
npm run batch-parse
```

## ⚙️ Environment Variables

```env
PORT=3000                                    # Server port
DB_PATH=./extremist_materials.db            # Database path
NODE_ENV=production                         # Environment
```

## 📝 License

MIT

## 🤝 Contributing

Pull requests welcome!

## 📧 Contact

For issues and questions: [your@email.com]

---

**⚠️ Disclaimer:** Этот проект создан исключительно в информационных целях для проверки соответствия материалов официальному списку экстремистских материалов.
