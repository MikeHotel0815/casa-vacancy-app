import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Wird für API-Aufrufe benötigt

// Temporäre Platzhalter, werden später durch eigene Komponenten ersetzt
const MeterReadingList = ({ meter, token }) => {
    const [readings, setReadings] = useState([]);
    const [showReadingForm, setShowReadingForm] = useState(false);
    const [editingReading, setEditingReading] = useState(null); // Für das Bearbeiten/Erstellen Formular

    // Die API URL wird nun dynamisch im fetchReadings und handleReadingFormSubmit gebildet,
    // da meter.id (vorher meter._id) sich ändern kann oder initial null ist.

    const fetchReadings = useCallback(async () => {
        if (!meter || !meter.id) { // Prüfung auf meter und meter.id
            setReadings([]); // Reset readings if no valid meter
            return;
        }
        try {
            const apiUrl = `${import.meta.env.VITE_API_URL}/api/meters/${meter.id}/readings`;
            const response = await axios.get(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
            setReadings(response.data);
        } catch (error) {
            console.error(`Fehler beim Laden der Zählerstände für ${meter.name || meter.id}:`, error);
            setReadings([]); // Clear readings on error
        }
    }, [meter, token]);

    useEffect(() => {
        // Fetch readings when the meter prop changes and is valid
        if (meter && meter.id) {
            fetchReadings();
        } else {
            setReadings([]); // Clear readings if no meter is selected
        }
    }, [meter, fetchReadings]); // fetchReadings ist nun eine Abhängigkeit

    const handleAddReading = () => {
        if (!meter || !meter.id) {
            alert("Bitte wählen Sie zuerst einen Zähler aus.");
            return;
        }
        // Wichtig: meterId für das neue Reading setzen
        setEditingReading({ meterId: meter.id, date: new Date().toISOString().split('T')[0] });
        setShowReadingForm(true);
    };

    const handleEditReading = (reading) => {
        setEditingReading({ ...reading, date: new Date(reading.date).toISOString().split('T')[0] });
        setShowReadingForm(true);
    };

    const handleDeleteReading = async (readingId) => {
        if (window.confirm("Diesen Zählerstand wirklich löschen?")) {
            try {
                await axios.delete(`${import.meta.env.VITE_API_URL}/api/meters/reading/${readingId}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchReadings();
            } catch (error) {
                alert("Fehler beim Löschen des Zählerstands.");
            }
        }
    };

    const handleReadingFormSubmit = async (readingDataFromForm) => {
        // Ensure meterId is part of the data sent, especially for new readings
        const readingPayload = { ...readingDataFromForm };
        if (!readingPayload.meterId && meter && meter.id) { // meterId ist im Formular nicht explizit, also hier hinzufügen
            readingPayload.meterId = meter.id;
        }

        // API URL für POST (neu erstellen)
        let apiUrl = `${import.meta.env.VITE_API_URL}/api/meters/${readingPayload.meterId}/readings`;
        let httpMethod = 'post';

        if (readingPayload.id) { // Update, wenn eine ID vorhanden ist (vorher _id)
            apiUrl = `${import.meta.env.VITE_API_URL}/api/meters/reading/${readingPayload.id}`;
            httpMethod = 'put';
        }

        if (!readingPayload.meterId && httpMethod === 'post') {
            alert("Fehler: Zähler-ID fehlt. Kann Zählerstand nicht erstellen.");
            console.error("Submit Reading Error: meterId is missing for new reading.", readingPayload);
            return;
        }

        try {
            if (httpMethod === 'put') {
                 await axios.put(apiUrl, readingPayload, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                 await axios.post(apiUrl, readingPayload, { headers: { Authorization: `Bearer ${token}` } });
            }
            fetchReadings(); // Re-fetch readings for the current meter
            setShowReadingForm(false);
            setEditingReading(null);
        } catch (error) {
             console.error("Fehler beim Speichern des Zählerstands:", error.response?.data || error.message, error);
             alert(error.response?.data?.msg || "Zählerstand konnte nicht gespeichert werden.");
        }
    };

    // Wenn kein Meter ausgewählt ist, zeige nichts für die Zählerstände an.
    if (!meter || !meter.id) {
        return <div className="mt-6 p-4 text-sm text-gray-500">Bitte wählen Sie einen Zähler, um dessen Zählerstände anzuzeigen oder zu erfassen.</div>;
    }

    if (showReadingForm && editingReading) {
        // currentReading an MeterReadingForm übergeben, es enthält meterId für neue Readings
        return <MeterReadingForm currentReading={editingReading} onSubmit={handleReadingFormSubmit} onCancel={() => { setShowReadingForm(false); setEditingReading(null); }} meterUnit={meter.unit} />;
    }

    return (
        <div className="mt-6">
            <h4 className="text-md font-semibold mb-2">Zählerstände für: {meter.name}</h4>
            <button onClick={handleAddReading} className="btn btn-success btn-sm mb-3">Neuen Zählerstand erfassen</button>
            {readings.length === 0 && <p className="text-sm text-gray-500">Keine Zählerstände für diesen Zähler erfasst.</p>}
            <ul className="space-y-2">
                {readings.map(r => (
                    // Verwende r.id statt r._id für den key und Operationen
                    <li key={r.id} className="text-sm p-2 border rounded bg-gray-50 flex justify-between items-center">
                        <span>{new Date(r.date).toLocaleDateString('de-DE')}: <strong>{r.value} {meter.unit}</strong> {r.notes && `(${r.notes})`}</span>
                        <div>
                            {r.photoUrl && <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 mr-2">Foto</a>}
                            <button onClick={() => handleEditReading(r)} className="btn-xs btn-secondary mr-1">Edit</button>
                            <button onClick={() => handleDeleteReading(r.id)} className="btn-xs bg-red-500 hover:bg-red-600 text-white">Del</button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const MeterReadingForm = ({ currentReading, onSubmit, onCancel, meterUnit }) => {
    // Initialisiere State basierend auf currentReading, das jetzt auch meterId für neue Einträge enthält
    const [value, setValue] = useState(currentReading?.value || '');
    // Stelle sicher, dass date ein String im Format YYYY-MM-DD ist, wenn es von currentReading kommt
    const formatDateForInput = (dateStr) => {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        // Wenn es bereits ein Date-Objekt ist (z.B. von new Date()), konvertiere es.
        // Wenn es ein String ist, stelle sicher, dass es das richtige Format hat.
        // Die API erwartet YYYY-MM-DD, also sollte es so bleiben.
        return new Date(dateStr).toISOString().split('T')[0];
    };
    const [date, setDate] = useState(formatDateForInput(currentReading?.date));
    const [photoUrl, setPhotoUrl] = useState(currentReading?.photoUrl || '');
    const [notes, setNotes] = useState(currentReading?.notes || '');

    useEffect(() => {
        setValue(currentReading?.value || '');
        setDate(formatDateForInput(currentReading?.date));
        setPhotoUrl(currentReading?.photoUrl || '');
        setNotes(currentReading?.notes || '');
    }, [currentReading]);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Übergebe das vollständige currentReading Objekt, das meterId und ggf. id (für Update) enthält
        onSubmit({
            ...currentReading, // Beinhaltet id (für Update) und meterId (für neu)
            value: parseFloat(value),
            date, // Ist bereits YYYY-MM-DD String
            photoUrl,
            notes
        });
    };

    return (
         <form onSubmit={handleSubmit} className="p-4 bg-gray-100 rounded shadow my-4 border">
            {/* Verwende currentReading.id statt currentReading._id für die Titelanzeige */}
            <h4 className="text-md font-semibold mb-3">{currentReading?.id ? 'Zählerstand bearbeiten' : 'Neuen Zählerstand erfassen'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="readingValue" className="block text-sm font-medium text-gray-700">Zählerstand ({meterUnit || 'Einheit'}):</label>
                    <input type="number" step="any" id="readingValue" value={value} onChange={(e) => setValue(e.target.value)} required className="input-field" />
                </div>
                <div>
                    <label htmlFor="readingDate" className="block text-sm font-medium text-gray-700">Datum:</label>
                    <input type="date" id="readingDate" value={date} onChange={(e) => setDate(e.target.value)} required className="input-field" />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="readingPhotoUrl" className="block text-sm font-medium text-gray-700">Foto URL (optional):</label>
                    <input type="url" id="readingPhotoUrl" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="input-field" placeholder="https://example.com/foto.jpg"/>
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="readingNotes" className="block text-sm font-medium text-gray-700">Notizen (optional):</label>
                    <textarea id="readingNotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows="2"></textarea>
                </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
                <button type="button" onClick={onCancel} className="btn btn-secondary">Abbrechen</button>
                <button type="submit" className="btn btn-primary">{currentReading?._id ? 'Speichern' : 'Erfassen'}</button>
            </div>
        </form>
    );
};


// MeterList Komponente
const MeterList = ({ meters, onSelectMeter, onEditMeter, onDeleteMeter, onAddNewMeter, selectedMeterId }) => (
  <div className="p-4 bg-white rounded-lg shadow-md">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xl font-semibold text-gray-700">Verfügbare Zähler</h3>
      <button onClick={onAddNewMeter} className="btn btn-primary">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 inline" viewBox="0 0 20 20" fill="currentColor"> {/* Größe auf h-4 w-4 reduziert */}
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Neuer Zähler
      </button>
    </div>
    {meters.length === 0 && <p className="text-gray-500">Keine Zähler vorhanden. Legen Sie einen neuen an.</p>}
    <ul className="space-y-2">
      {meters.map(meter => (
        <li
          key={meter.id} // Geändert von meter._id zu meter.id
          className={`p-3 border rounded-md hover:shadow-lg transition-shadow cursor-pointer flex justify-between items-center group
                      ${selectedMeterId === meter.id ? 'bg-primary-light border-primary ring-2 ring-primary' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`}
          onClick={() => onSelectMeter(meter)}
        >
          <div>
            <span className={`font-medium ${selectedMeterId === meter.id ? 'text-primary-text-strong' : 'text-gray-800'}`}>{meter.name}</span>
            <span className={`text-sm ml-2 ${selectedMeterId === meter.id ? 'text-primary-text' : 'text-gray-500'}`}>({meter.unit})</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
            <button onClick={(e) => { e.stopPropagation(); onEditMeter(meter); }} className="btn-icon btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDeleteMeter(meter.id); }} className="btn-icon bg-red-500 hover:bg-red-600 text-white"> {/* Geändert von meter._id zu meter.id */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

// MeterForm Komponente
const MeterForm = ({ currentMeter, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [id, setId] = useState(null); // Explizit null für neue Zähler

  useEffect(() => {
    // currentMeter kann initial {} sein für neue Zähler, oder ein existierender Zähler
    setName(currentMeter?.name || '');
    setUnit(currentMeter?.unit || '');
    setId(currentMeter?.id || null); // Verwende currentMeter.id
  }, [currentMeter]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) {
        alert("Name und Einheit dürfen nicht leer sein.");
        return;
    }
    // Stelle sicher, dass 'id' (nicht '_id') übergeben wird
    onSubmit({ id: id, name, unit });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
        <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
            {/* Verwende id (nicht _id) für die Titelanzeige */}
            <h3 className="text-xl font-semibold mb-6 text-gray-700">{id ? 'Zähler bearbeiten' : 'Neuen Zähler erstellen'}</h3>
            <div className="mb-4">
                <label htmlFor="meterName" className="block text-sm font-medium text-gray-700 mb-1">Name des Zählers:</label>
                <input type="text" id="meterName" value={name} onChange={(e) => setName(e.target.value)} required className="input-field" placeholder="z.B. Stromzähler Keller"/>
            </div>
            <div className="mb-6">
                <label htmlFor="meterUnit" className="block text-sm font-medium text-gray-700 mb-1">Einheit:</label>
                <input type="text" id="meterUnit" value={unit} onChange={(e) => setUnit(e.target.value)} required className="input-field" placeholder="z.B. kWh, m³, Stk."/>
            </div>
            <div className="flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="btn btn-secondary">Abbrechen</button>
                <button type="submit" className="btn btn-primary">{id ? 'Änderungen speichern' : 'Zähler erstellen'}</button>
            </div>
        </form>
    </div>
  );
};

// Hauptkomponente für Zähler und Zählerstände
const MeterManagement = ({ currentUser }) => {
  const [meters, setMeters] = useState([]);
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [editingMeter, setEditingMeter] = useState(null);
  const [showMeterFormModal, setShowMeterFormModal] = useState(false);

  const API_URL = `${import.meta.env.VITE_API_URL}/api/meters`;
  const token = localStorage.getItem('token');

  const fetchMeters = useCallback(async () => {
    try {
      const response = await axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } });
      setMeters(response.data);
    } catch (error) {
      console.error("Fehler beim Laden der Zähler:", error);
      alert(error.response?.data?.msg || "Zähler konnten nicht geladen werden.");
    }
  }, [API_URL, token]);

  useEffect(() => {
    fetchMeters();
  }, [fetchMeters]);

  const handleSelectMeter = (meter) => {
    setSelectedMeter(meter);
  };

  const handleAddNewMeter = () => {
    setEditingMeter({ name: '', unit: '' }); // Initialisiere für neuen Zähler
    setShowMeterFormModal(true);
    setSelectedMeter(null); // Auswahl aufheben, wenn Formular für neuen Zähler geöffnet wird
  };

  const handleEditMeter = (meter) => {
    setEditingMeter(meter);
    setShowMeterFormModal(true);
     setSelectedMeter(null); // Auswahl aufheben, um Verwirrung zu vermeiden
  };

  const handleMeterFormSubmit = async (meterData) => {
    try {
      // meterData.id wird vom MeterForm übergeben (kann null sein für neue Zähler)
      if (meterData.id) {
        await axios.put(`${API_URL}/${meterData.id}`, meterData, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        // Entferne die 'id'-Eigenschaft, wenn sie null ist, bevor sie an das Backend gesendet wird für POST
        const { id, ...newMeterData } = meterData;
        await axios.post(API_URL, newMeterData, { headers: { Authorization: `Bearer ${token}` } });
      }
      fetchMeters();
      setShowMeterFormModal(false);
      setEditingMeter(null);
    } catch (error) {
      console.error("Fehler beim Speichern des Zählers:", error.response?.data || error.message, error);
      alert(error.response?.data?.msg || "Zähler konnte nicht gespeichert werden.");
    }
  };

  const handleDeleteMeter = async (meterId) => { // meterId ist hier die korrekte ID (Zahl)
    if (window.confirm("Möchten Sie diesen Zähler und alle zugehörigen Zählerstände wirklich löschen? Das kann nicht rückgängig gemacht werden.")) {
      try {
        await axios.delete(`${API_URL}/${meterId}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchMeters();
        // Verwende .id für Vergleiche
        if (selectedMeter?.id === meterId) setSelectedMeter(null);
        if (editingMeter?.id === meterId) {
            setShowMeterFormModal(false);
            setEditingMeter(null);
        }
      } catch (error) {
        console.error("Fehler beim Löschen des Zählers:", error.response?.data || error.message, error);
        alert(error.response?.data?.msg || "Zähler konnte nicht gelöscht werden.");
      }
    }
  };

  const handleCancelMeterForm = () => {
    setShowMeterFormModal(false);
    setEditingMeter(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">Zähler und Zählerstände</h2>

      {showMeterFormModal && editingMeter && (
        <MeterForm
          currentMeter={editingMeter}
          onSubmit={handleMeterFormSubmit}
          onCancel={handleCancelMeterForm}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <MeterList
            meters={meters}
            onSelectMeter={handleSelectMeter}
            onEditMeter={handleEditMeter}
            onDeleteMeter={handleDeleteMeter}
            onAddNewMeter={handleAddNewMeter}
            selectedMeterId={selectedMeter?.id}
          />
        </div>
        <div className="lg:col-span-2">
          {selectedMeter ? (
            <div className="p-6 bg-white rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-2 text-gray-700">Details für: {selectedMeter.name}</h3>
              {/* Verwende selectedMeter.id für die Anzeige */}
              <p className="text-sm text-gray-500 mb-6">Einheit: {selectedMeter.unit} | ID: {selectedMeter.id}</p>
              <MeterReadingList meter={selectedMeter} token={token} />
            </div>
          ) : (
            <div className="p-10 bg-white rounded-lg shadow-md text-center text-gray-500 h-full flex flex-col justify-center items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"> {/* Größe auf h-12 w-12 reduziert */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <p className="text-lg">Bitte wählen Sie einen Zähler aus der Liste.</p>
              <p className="text-sm mt-1">Oder legen Sie über den Button links einen neuen Zähler an.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeterManagement;
