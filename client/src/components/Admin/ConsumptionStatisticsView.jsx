import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Einfache Balkendiagramm-Komponente (kann bei Bedarf in eine eigene Datei ausgelagert werden)
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
                className="bg-accent h-full rounded-full text-xs text-white flex items-center justify-end px-2.5 transition-all duration-500 ease-out"
                style={{ width: `${maxValue > 0 ? ((parseFloat(item[dataKey]) || 0) / maxValue) * 100 : 0}%` }}
                title={`${(parseFloat(item[dataKey]) || 0).toFixed(3)} ${unit}`}
              >
                <span className="truncate">{(parseFloat(item[dataKey]) || 0).toFixed(3)} {unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const ConsumptionStatisticsView = ({ currentUser }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [meters, setMeters] = useState([]);
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_STATS_URL = `${import.meta.env.VITE_API_URL}/api/statistics/consumption`;
  const API_METERS_URL = `${import.meta.env.VITE_API_URL}/api/meters`;
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchMeters = async () => {
      setLoading(true);
      try {
        const response = await axios.get(API_METERS_URL, { headers: { Authorization: `Bearer ${token}` } });
        setMeters(response.data);
        // Optional: Ersten Zähler vorauswählen, falls vorhanden und keiner ausgewählt ist
        // if (response.data.length > 0 && !selectedMeterId) {
        //   setSelectedMeterId(response.data[0]._id);
        // }
      } catch (err) {
        console.error("Fehler beim Laden der Zählerliste:", err);
        setError("Zählerliste konnte nicht geladen werden.");
      }
      setLoading(false);
    };
    fetchMeters();
  }, [API_METERS_URL, token]);

  const fetchConsumptionStats = useCallback(async (meterId, selectedYear) => {
    if (!meterId) {
      setStatsData(null); // Reset data if no meter is selected
      // setError("Bitte wählen Sie einen Zähler aus."); // User should see placeholder instead
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_STATS_URL}/${meterId}/${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatsData(response.data);
    } catch (err) {
      console.error("Fehler beim Laden der Verbrauchsstatistik:", err);
      setError(err.response?.data?.msg || "Verbrauchsdaten konnten nicht geladen werden.");
      setStatsData(null);
    } finally {
      setLoading(false);
    }
  }, [API_STATS_URL, token]);

  // Effect to load stats when meter or year changes
  useEffect(() => {
    if (selectedMeterId && year) {
      fetchConsumptionStats(selectedMeterId, year);
    } else {
      setStatsData(null);
    }
  }, [fetchConsumptionStats, selectedMeterId, year]);

  const getMonthName = (monthNumber) => {
    const date = new Date(year, monthNumber - 1, 1);
    return date.toLocaleString('de-DE', { month: 'long' });
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">Statistik: Zählerverbrauch</h2>

      <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
        <div>
          <label htmlFor="meter-select-stats" className="text-md font-medium text-gray-700 mr-2">Zähler:</label>
          <select
            id="meter-select-stats"
            value={selectedMeterId}
            onChange={(e) => setSelectedMeterId(e.target.value)}
            className="input-field py-2.5 px-4 w-full sm:w-auto min-w-[200px]"
            disabled={meters.length === 0 && !loading}
          >
            <option value="">-- Zähler wählen --</option>
            {meters.map(meter => (
              <option key={meter.id} value={meter.id}>{meter.name} ({meter.unit})</option> // Geändert auf meter.id
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="year-select-consumption" className="text-md font-medium text-gray-700 mr-2">Jahr:</label>
          <select
            id="year-select-consumption"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="input-field py-2.5 px-4 w-full sm:w-auto"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
         <button
          onClick={() => fetchConsumptionStats(selectedMeterId, year)}
          disabled={loading || !selectedMeterId}
          className="btn btn-primary w-full sm:w-auto flex items-center justify-center"
        >
          {loading && !selectedMeterId ? null : loading ? (
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> {/* Größe auf h-4 w-4 und mr-2 reduziert */}
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"> {/* Größe auf h-4 w-4 reduziert */}
               <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          )}
          {loading && selectedMeterId ? 'Lädt...' : 'Aktualisieren'}
        </button>
      </div>

      {error && <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-lg shadow" role="alert">{error}</div>}

      {/* Verwende meter.id für den Vergleich */}
      {loading && !error && selectedMeterId && <div className="text-center py-10"><p className="text-lg text-gray-600">Lade Verbrauchsdaten für {meters.find(m=>m.id === parseInt(selectedMeterId))?.name} ({year})...</p></div>}

      {!loading && !error && !selectedMeterId && meters.length > 0 && (
        <div className="text-center py-10 bg-white rounded-lg shadow-md">
             <p className="text-lg text-gray-500">Bitte wählen Sie einen Zähler aus, um die Verbrauchsstatistik anzuzeigen.</p>
        </div>
      )}
      {!loading && !error && meters.length === 0 && (
        <div className="text-center py-10 bg-white rounded-lg shadow-md">
             <p className="text-lg text-gray-500">Keine Zähler vorhanden. Bitte legen Sie zuerst Zähler im Bereich "Zähler & Ablesungen" an.</p>
        </div>
      )}

      {!loading && !error && statsData && statsData.monthlyConsumption && (
        <>
          <div className="mb-8">
            <SimpleBarChart
                data={statsData.monthlyConsumption.map(d => ({ ...d, monthName: getMonthName(d.month) }))}
                dataKey="consumption"
                labelKey="monthName"
                unit={statsData.unit || ''}
                chartTitle={`Monatsverbrauch: ${statsData.meterName || 'Ausgewählter Zähler'} (${year})`}
            />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Datenübersicht: {statsData.meterName} ({statsData.unit}) - {year}</h3>
            {statsData.message && <p className={`text-sm p-3 rounded mb-3 ${statsData.message.includes("Nicht genügend") || statsData.message.includes("Keine Zählerstände") ? "bg-yellow-50 text-yellow-700" : "bg-blue-50 text-blue-700"}`}>{statsData.message}</p>}
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monat</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verbrauch ({statsData.unit})</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Geschätzt?</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tage mit Daten</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tage im Monat</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statsData.monthlyConsumption.map(row => (
                  <tr key={row.month} className={`hover:bg-gray-50 transition-colors ${row.estimated ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{getMonthName(row.month)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{(row.consumption || 0).toFixed(3)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${row.estimated ? 'text-yellow-700 font-semibold' : 'text-gray-600'}`}>{row.estimated ? 'Ja' : 'Nein'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{(row.daysWithReadings || 0).toFixed(1)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.totalDaysInMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!loading && !error && selectedMeterId && !statsData?.monthlyConsumption && !statsData?.message && (
          <div className="text-center py-10 bg-white rounded-lg shadow-md">
            <p className="text-lg text-gray-500">Keine Verbrauchsdaten für den ausgewählten Zähler und das Jahr ({year}) verfügbar oder es gab einen Fehler beim Laden.</p>
        </div>
      )}
    </div>
  );
};

export default ConsumptionStatisticsView;
