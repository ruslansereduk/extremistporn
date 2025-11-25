import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[rgb(var(--bg-secondary))] transition-colors"
            aria-label="Toggle theme"
        >
            {theme === 'light' ? (
                <Moon className="h-5 w-5 text-[rgb(var(--text-secondary))]" />
            ) : (
                <Sun className="h-5 w-5 text-[rgb(var(--text-secondary))]" />
            )}
        </button>
    );
}
