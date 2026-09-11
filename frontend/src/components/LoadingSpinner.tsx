import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[200px] h-full w-full">
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className="absolute w-full h-full border-4 border-slate-800 rounded-full"></div>
        <div className="absolute w-full h-full border-4 border-t-cyan-500 border-r-purple-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        <div className="absolute w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></div>
      </div>
    </div>
  );
};
