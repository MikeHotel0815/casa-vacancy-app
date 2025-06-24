import { useState, useEffect } from 'react';
import axios from 'axios'; // axios für API-Anfragen importieren
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import de from 'date-fns/locale/de';

import 'react-big-calendar/lib/css/react-big-calendar.css';

// Die Basis-URL Ihrer Backend-API
const API_URL = `${import.meta.env.VITE_API_URL}/api`;

const locales = {
  'de': de,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Hilfsfunktion, um den ersten Buchstaben eines Strings groß zu machen
const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

function App() {
  // --- STATES ---
  const [events, setEvents] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);

  // States, um den Kalender explizit zu steuern
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(Views.MONTH);


  // --- DATEN LADEN MIT useEffect ---
  useEffect(() => {
    // Hilfsfunktion zum Abrufen aller Daten
    const fetchAllEvents = async () => {
      try {
        const year = date.getFullYear(); // Jahr dynamisch aus dem Kalender-State holen

        // Parallele API-Anfragen für eine bessere Performance
        const [bookingsRes, publicHolidaysRes, schoolHolidaysRes] = await Promise.all([
          axios.get(`${API_URL}/bookings`),
          axios.get(`${API_URL}/holidays/public/HE?year=${year}`), // Jahr an die API übergeben
          axios.get(`${API_URL}/holidays/school/HE?year=${year}`)
        ]);

        // Buchungen verarbeiten
        const formattedBookings = bookingsRes.data.map(booking => ({
          title: `Belegt (ID: ${booking.id})`,
          start: new Date(booking.startDate),
          end: new Date(booking.endDate),
          type: 'booking', // Typ für die farbliche Unterscheidung
        }));

        // Feiertage verarbeiten (mit gekürztem Titel)
        const formattedPublicHolidays = publicHolidaysRes.data.map(holiday => ({
          title: holiday.localName,
          start: new Date(holiday.date),
          end: new Date(holiday.date),
          allDay: true,
          type: 'publicHoliday',
        }));
        
        // Schulferien verarbeiten (mit gekürztem und formatiertem Titel)
        const formattedSchoolHolidays = schoolHolidaysRes.data.map(holiday => {
          // Nimmt nur den ersten Teil des Namens (z.B. "Osterferien" aus "Osterferien Hessen 2024")
          const holidayName = holiday.name.split(' ')[0];
          return {
            title: capitalizeFirstLetter(holidayName),
            start: new Date(holiday.start),
            end: new Date(holiday.end),
            type: 'schoolHoliday',
          };
        });

        // Alle Events zusammenführen und im State speichern
        setEvents([
            ...formattedBookings, 
            ...formattedPublicHolidays, 
            ...formattedSchoolHolidays
        ]);

      } catch (error) {
        console.error("Fehler beim Laden der Kalenderdaten:", error);
      }
    };

    fetchAllEvents();
  }, [date]); // Dieser Effekt wird jetzt jedes Mal ausgeführt, wenn sich das Datum ändert.


  // --- FUNKTIONEN ---
  const handleSelectSlot = ({ start }) => {
    // Die Logik für die Buchungserstellung bleibt vorerst gleich
    if (!selectionStart) {
      setSelectionStart(start);
    } else {
      const newEndDate = start > selectionStart ? start : selectionStart;
      const newStartDate = start > selectionStart ? start : start;
      
      const bookingTitle = `Buchung von ${format(newStartDate, 'dd.MM')} bis ${format(newEndDate, 'dd.MM')}`;
      console.log("Neue Buchung:", bookingTitle);

      // TODO: API-Aufruf an das Backend zum Speichern der Buchung
      // (erfordert Authentifizierung)

      setSelectionStart(null);
    }
  };

  // Funktion zur farblichen Gestaltung der Events
  const eventStyleGetter = (event) => {
    let style = {
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block',
      fontWeight: 'bold',
    };
    switch (event.type) {
      case 'booking':
        style.backgroundColor = '#dc2626'; // Rot
        break;
      case 'publicHoliday':
        style.backgroundColor = '#2563eb'; // Blau
        break;
      case 'schoolHoliday':
        style.backgroundColor = '#16a34a'; // Grün
        break;
      default:
        style.backgroundColor = '#64748b'; // Grau
        break;
    }
    return { style };
  };


  // --- RENDERING ---
  return (
    <div className="flex justify-center items-start bg-gray-200 w-screen h-screen overflow-auto">
      <div className="bg-gray-50 shadow-2xl" style={{ width: '1920px', height: '1080px' }}>
        <div className="p-4 md:p-8 h-full">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
            Belegungskalender Ferienhaus
          </h1>

          <div style={{ height: 'calc(100% - 150px)' }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              selectable
              onSelectSlot={handleSelectSlot}
              culture='de'
              // Props, die den Kalender steuern
              date={date}
              view={view}
              onNavigate={setDate}
              onView={setView}
              messages={{
                next: "Nächster",
                previous: "Vorheriger",
                today: "Heute",
                month: "Monat",
                week: "Woche",
                day: "Tag",
                agenda: "Agenda",
                date: "Datum",
                time: "Zeit",
                event: "Ereignis",
                noEventsInRange: "Keine Termine in diesem Zeitraum.",
              }}
              eventPropGetter={eventStyleGetter} // Prop für das Styling
              style={{ height: '100%' }}
            />
          </div>

          {selectionStart && (
            <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded text-center animate-pulse">
              Startdatum ausgewählt: <strong>{format(selectionStart, 'dd.MM.yyyy')}</strong>. Bitte Enddatum auswählen oder erneut auf das Startdatum klicken zum Abbrechen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
