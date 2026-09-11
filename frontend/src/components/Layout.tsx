import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col md:ml-72 min-h-screen transition-all duration-300">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center h-16 px-4 bg-slate-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold gradient-text">Cyber360</span>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
