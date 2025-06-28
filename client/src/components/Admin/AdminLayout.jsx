import React, { useState } from 'react';
import MeterManagement from './MeterManagement'; // Importiert die neue Komponente
import LayoutStatisticsView from './LayoutStatisticsView'; // Importiert LayoutStatisticsView
import ConsumptionStatisticsView from './ConsumptionStatisticsView'; // Importiert ConsumptionStatisticsView

const AdminLayout = ({ currentUser, onLogout, navigateToCalendar }) => {
  const [activeAdminView, setActiveAdminView] = useState('meters'); // 'meters', 'stats_layout', 'stats_consumption'

  if (!currentUser || !currentUser.isAdmin) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-screen bg-gray-100">
        <h2 className="text-3xl font-bold text-red-600 mb-4">Zugriff verweigert</h2>
        <p className="text-lg text-gray-700 mb-6">Sie müssen Administrator sein, um diesen Bereich anzuzeigen.</p>
        <button
          onClick={navigateToCalendar}
          className="btn btn-primary"
        >
          Zurück zum Kalender
        </button>
      </div>
    );
  }

  const renderActiveAdminView = () => {
    switch (activeAdminView) {
      case 'meters':
        return <MeterManagement currentUser={currentUser} />;
      case 'stats_layout':
        return <LayoutStatisticsView currentUser={currentUser} />;
      case 'stats_consumption':
        return <ConsumptionStatisticsView currentUser={currentUser} />;
      default:
        return <div className="p-4 rounded bg-white shadow">Bitte eine Ansicht auswählen.</div>;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-gray-700 text-white p-4 shadow-lg z-10">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <button
                onClick={navigateToCalendar}
                className="btn bg-gray-600 hover:bg-gray-500 text-white"
            >
                Kalender
            </button>
            <button
                onClick={onLogout}
                className="btn btn-secondary"
            >
                Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-60 bg-gray-800 text-white p-5 space-y-3 shadow-md">
          <h2 className="text-lg font-semibold mb-4 border-b border-gray-700 pb-2">Navigation</h2>
          <button
            onClick={() => setActiveAdminView('meters')}
            className={`w-full text-left px-4 py-2.5 rounded transition-colors duration-150 ease-in-out
                        ${activeAdminView === 'meters' ? 'bg-primary text-primary-text font-semibold shadow-sm' : 'hover:bg-gray-700'}`}
          >
            Zähler & Ablesungen
          </button>
          <button
            onClick={() => setActiveAdminView('stats_layout')}
            className={`w-full text-left px-4 py-2.5 rounded transition-colors duration-150 ease-in-out
                        ${activeAdminView === 'stats_layout' ? 'bg-primary text-primary-text font-semibold shadow-sm' : 'hover:bg-gray-700'}`}
          >
            Statistik: Auslegung
          </button>
          <button
            onClick={() => setActiveAdminView('stats_consumption')}
            className={`w-full text-left px-4 py-2.5 rounded transition-colors duration-150 ease-in-out
                        ${activeAdminView === 'stats_consumption' ? 'bg-primary text-primary-text font-semibold shadow-sm' : 'hover:bg-gray-700'}`}
          >
            Statistik: Verbrauch
          </button>
          {/* Weitere Admin-Links hier */}
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {renderActiveAdminView()}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
