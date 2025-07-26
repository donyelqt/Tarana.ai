import React from 'react';

interface LoadingSpinnerProps {
  show: boolean;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ show, message = "Finding..." }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-lg">
        <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-blue-500"></div>
        <p className="mt-4 text-lg font-semibold text-gray-700">{message}</p>
      </div>
    </div>
  );
};

export { LoadingSpinner };
