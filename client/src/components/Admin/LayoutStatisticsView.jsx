import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Einfache Balkendiagramm-Komponente
const SimpleBarChart = ({ data, dataKey, labelKey, unit, chartTitle }) => {
  if (!data || data.length === 0) return <p className="text-sm text-gray-500">Keine Daten für das Diagramm vorhanden.</p>;

  const maxValue = Math.max(...data.map(item => parseFloat(item[dataKey]) || 0), 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h4 className="text-lg font-semibold text-gray-700 mb-4">{chartTitle}</h4>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center group">
            <div className="w-24 text-sm text-gray-600 truncate group-hover:font-semibold">{item[labelKey]}:</div>
            <div className="flex-grow bg-gray-200 rounded-full h-6 overflow-hidden mr-2 shadow-inner">
              <div
                className="bg-primary h-full rounded-full text-xs text-white flex items-center justify-end px-2.5 transition-all duration-500 ease-out"
                style={{ width: `${maxValue > 0 ? ((parseFloat(item[dataKey]) || 0) / maxValue) * 100 : 0}%` }}
                title={`${item[dataKey]} ${unit}`}
              >
                <span className="truncate">{item[dataKey]} {unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const LayoutStatisticsView = ({ currentUser }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [statsData, setStatsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_URL = `${import.meta.env.VITE_API_URL}/api/statistics/layout`;
  const token = localStorage.getItem('token');

  const fetchLayoutStats = useCallback(async (selectedYear) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatsData(response.data);
    } catch (err) {
      console.error("Fehler beim Laden der Auslegungsstatistik:", err);
      setError(err.response?.data?.msg || "Daten konnten nicht geladen werden. Stellen Sie sicher, dass der Server läuft und erreichbar ist.");
      setStatsData([]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, token]);

  useEffect(() => {
    fetchLayoutStats(year);
  }, [fetchLayoutStats, year]);

  const handleYearChange = (e) => {
    setYear(parseInt(e.target.value, 10));
  };

  const getMonthName = (monthNumber) => {
    const date = new Date(year, monthNumber - 1, 1); // Ensure year is correct for month name context
    return date.toLocaleString('de-DE', { month: 'long' });
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i); // Last 5 years, current year, next 5 years


  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">Statistik: Jährliche Hausauslegung</h2>
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
        <label htmlFor="year-select" className="text-md font-medium text-gray-700">Jahr auswählen:</label>
        <select
          id="year-select"
          value={year}
          onChange={handleYearChange}
          className="input-field py-2.5 px-4 w-full sm:w-auto"
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={() => fetchLayoutStats(year)}
          disabled={loading}
          className="btn btn-primary w-full sm:w-auto flex items-center justify-center"
        >
          {loading ? (
            null /* SVG spinner removed */
          ) : (
            null /* SVG reload icon removed */
          )}
          {loading ? 'Lädt...' : 'Aktualisieren'}
        </button>
      </div>

      {error && <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg shadow" role="alert">{error}</div>}

      {loading && !error && <div className="text-center py-10"><p className="text-lg text-gray-600">Lade Statistikdaten für {year}...</p></div>}

      {!loading && !error && statsData.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <SimpleBarChart
                data={statsData.map(d => ({ ...d, monthName: getMonthName(d.month) }))}
                dataKey="occupancyRate"
                labelKey="monthName"
                unit="%"
                chartTitle={`Auslastung für ${year}`}
            />
            <SimpleBarChart
                data={statsData.map(d => ({ ...d, monthName: getMonthName(d.month) }))}
                dataKey="bookedDays"
                labelKey="monthName"
                unit="Tage"
                chartTitle={`Gebuchte Tage für ${year}`}
            />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Datenübersicht für {year}</h3>
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monat</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gebuchte Tage</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tage im Monat</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auslastung</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statsData.map(row => (
                  <tr key={row.month} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getMonthName(row.month)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.bookedDays}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.totalDaysInMonth}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.occupancyRate.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!loading && !error && statsData.length === 0 && (
          <div className="text-center py-10 bg-white rounded-lg shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-lg text-gray-500">Keine Statistikdaten für das ausgewählte Jahr ({year}) verfügbar.</p>
        </div>
      )}
    </div>
  );
};

export default LayoutStatisticsView;
