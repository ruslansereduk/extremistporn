import React from 'react';

interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    loading?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, subtitle, icon, loading }) => {
    const renderIcon = () => {
        if (React.isValidElement(icon)) {
            return icon;
        }
        // Fallback for legacy string icons if needed, or just return null
        return null;
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {title}
                    </h3>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {typeof value === 'number' ? value.toLocaleString() : (value || '0')}
                    </p>
                    {subtitle && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {subtitle}
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="ml-4">
                        {renderIcon()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsCard;
