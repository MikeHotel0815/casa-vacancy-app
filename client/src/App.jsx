import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // Wichtig für die Portal-Funktion
import axios from 'axios';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import de from 'date-fns/locale/de';

// Komponenten importieren
import Login from './components/Login';
import Register from './components/Register';
import BookingConfirmationModal from './components/BookingConfirmationModal'; // Import new modal

import 'react-big-calendar/lib/css/react-big-calendar.css';

const API_URL = `${import.meta.env.VITE_API_URL}/api`;

const locales = { 'de': de };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Eigene Modal-Komponente, die Portals nutzt
const Modal = ({ children }) => {
  // Verwendet Inline-Styles für garantierte Positionierung
  const modalWrapperStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  return createPortal(
    <div style={modalWrapperStyle}>
      {children}
    </div>,
    document.body
  );
};


function App() {
  // --- AUTH & VIEW STATES ---
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('login'); 

  // --- CALENDAR & MODAL STATES ---
  const [events, setEvents] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null); // Added to store the end of the selection range
  const [date, setDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState(Views.MONTH);
  const [selectedBooking, setSelectedBooking] = useState(null); 
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // States for the new booking/reservation modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [modalStartDate, setModalStartDate] = useState(null);
  const [modalEndDate, setModalEndDate] = useState(null);
  const [ignoreNextCalendarClick, setIgnoreNextCalendarClick] = useState(false);

  const calendarRef = useRef(null); // Ref for the calendar container

  // --- EFFECTS ---
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (!user) return; 

    const fetchAllEvents = async () => {
      try {
        const year = date.getFullYear();
        const [bookingsRes, publicHolidaysRes, schoolHolidaysRes] = await Promise.all([
          axios.get(`${API_URL}/bookings`),
          axios.get(`${API_URL}/holidays/public/HE?year=${year}`),
          axios.get(`${API_URL}/holidays/school/HE?year=${year}`)
        ]);

        const formattedBookings = bookingsRes.data.map(booking => ({
          id: booking.id,
          userId: booking.userId,
          title: `${booking.status === 'reserved' ? 'Reserviert' : 'Belegt'}: ${booking.displayName}`,
          displayName: booking.displayName, // Store displayName separately for modal use
          start: new Date(booking.startDate),
          end: new Date(booking.endDate),
          type: 'booking',
          status: booking.status,
        }));
        const formattedPublicHolidays = publicHolidaysRes.data.map(holiday => ({
          title: holiday.localName,
          start: new Date(holiday.date),
          end: new Date(holiday.date),
          allDay: true,
          type: 'publicHoliday',
        }));
        const formattedSchoolHolidays = schoolHolidaysRes.data.map(holiday => {
          const holidayName = holiday.name.split(' ')[0];
          return {
            title: capitalizeFirstLetter(holidayName),
            start: new Date(holiday.start),
            end: new Date(holiday.end),
            type: 'schoolHoliday',
          };
        });

        setEvents([...formattedBookings, ...formattedPublicHolidays, ...formattedSchoolHolidays]);
      } catch (error) {
        console.error("Fehler beim Laden der Kalenderdaten:", error);
      }
    };

    fetchAllEvents();
  }, [date, user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // If the modal is shown, don't clear selection from clicks outside calendar
      // as the modal itself is outside but manages the selection process.
      // The modal has its own backdrop click handling.
      if (showBookingModal) {
        return;
      }

      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        // Click is outside the calendar component
        if (selectionStart || selectionEnd) { // Only clear if there's something selected
          setSelectionStart(null);
          setSelectionEnd(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [calendarRef, showBookingModal, selectionStart, selectionEnd]); // Add dependencies

  // --- HANDLER FUNCTIONS ---
  const handleLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setView('login');
  };

  const handleSelectSlot = ({ start, end, action }) => {
    if (ignoreNextCalendarClick) {
      setIgnoreNextCalendarClick(false); // Reset the flag
      return;
    }

    if (action === 'select') { // User finished a drag operation
      setSelectionStart(start);
      setSelectionEnd(end);
      // Open the modal directly for the dragged selection
      setModalStartDate(start); // Assuming start is always <= end from a drag
      setModalEndDate(end);
      setShowBookingModal(true);
    } else if (action === 'click') {
      if (!selectionStart || selectionEnd) {
        // Case 1: This is the FIRST click of a new selection period
        // OR selectionEnd is already set (e.g. from a drag), so this click starts a NEW selection.
        setSelectionStart(start);
        setSelectionEnd(null); // Clear previous selectionEnd
      } else {
        // Case 2: This is the SECOND click. selectionStart is set, and selectionEnd is NOT.
        // This click defines the end of the current selection period.
        const clickedEndDate = start;

        // Set selectionEnd immediately for visual feedback by dayPropGetter
        setSelectionEnd(clickedEndDate); // THIS IS THE FIX: ensure selectionEnd is set for dayPropGetter

        const finalStartDate = selectionStart < clickedEndDate ? selectionStart : clickedEndDate;
        const finalEndDate = selectionStart < clickedEndDate ? clickedEndDate : selectionStart;

        // Instead of booking directly, open the modal
        setModalStartDate(finalStartDate);
        setModalEndDate(finalEndDate);
        setShowBookingModal(true);

      // setSelectionStart(null); // These were for resetting earlier, now handled by modal closure logic or new selection
      // setSelectionEnd(null);   // These were for resetting earlier, now handled by modal closure logic or new selection
      }
    }
  };

  const handleModalSubmit = async (newStartDate, newEndDate, type) => {
    if (!token) {
      alert("Bitte melden Sie sich an.");
      setShowBookingModal(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setIgnoreNextCalendarClick(true);
      setTimeout(() => setIgnoreNextCalendarClick(false), 50);
      return;
    }
    try {
      await axios.post(
        `${API_URL}/bookings`,
        {
          startDate: format(newStartDate, 'yyyy-MM-dd'),
          endDate: format(newEndDate, 'yyyy-MM-dd'),
          status: type
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowBookingModal(false);
      setDate(new Date(date.getTime()));
      // setSelectionStart(null); // Keep selection for visual feedback until next user interaction
      // setSelectionEnd(null);   // Keep selection for visual feedback until next user interaction
      setIgnoreNextCalendarClick(true);
      setTimeout(() => setIgnoreNextCalendarClick(false), 50);
    } catch (error) {
      console.error(`Fehler beim ${type === 'booked' ? 'Buchen' : 'Reservieren'}:`, error);
      alert(error.response?.data?.msg || `Buchung/Reservierung konnte nicht erstellt werden.`);
    // On error, modal remains open, selection remains visible for context.
    // User can then retry, change dates, or cancel via handleModalClose.
    }
  // No finally block needed here as success and error paths are distinct.
  };

const handleModalClose = () => {
  setShowBookingModal(false);
  // setSelectionStart(null); // Keep selection for visual feedback
  // setSelectionEnd(null);   // Keep selection for visual feedback
  setIgnoreNextCalendarClick(true);
  // It's safer to reset ignoreNextCalendarClick in handleSelectSlot
  // or use a very short timeout if clicks outside calendar are possible ways to close modal.
  // For now, if handleSelectSlot is the only way a day gets selected, resetting it there is fine.
  // If modal can be closed by other means not involving a calendar click (e.g. ESC key),
  // then a timeout here would be more robust for resetting the flag.
  // Let's assume backdrop or cancel button click are main methods.
  // If click is on backdrop NOT on a calendar cell, handleSelectSlot won't fire.
  // So, a timeout is indeed more robust.
  setTimeout(() => setIgnoreNextCalendarClick(false), 50);
};

const handleChangeBookingStatus = async (bookingToUpdate, newStatus) => {
  if (!token || !bookingToUpdate) {
    alert("Aktion nicht möglich.");
    return;
  }
  try {
    await axios.put(
      `${API_URL}/bookings/${bookingToUpdate.id}`,
      { status: newStatus },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setSelectedBooking(null); // Close the detail modal
    setDate(new Date(date.getTime())); // Refresh calendar data
  } catch (error) {
    console.error(`Fehler beim Ändern des Status zu ${newStatus}:`, error);
    alert(error.response?.data?.msg || "Status konnte nicht geändert werden.");
    // Keep detail modal open on error
  }
};

  const handleSelecting = (range) => {
    // This function is called when the user is dragging to select a range.
    // It should return true to allow the selection, or false to prevent it.
    // react-big-calendar will visually indicate the drag selection.
    // We don't need to set state here for that default visual feedback.
    // console.log('Currently selecting:', range);
    return true; // Allow selection
  };
  
  const handleSelectEvent = (event) => {
    if (user && event && event.type === 'booking' && String(event.userId) === String(user.id)) {
      setSelectedBooking(event);
      setShowConfirmDelete(false); // Reset confirmation view
    }
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking || !token) return;
    try {
        await axios.delete(`${API_URL}/bookings/${selectedBooking.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedBooking(null); // Modal schließen
        setShowConfirmDelete(false);
        setDate(new Date(date.getTime())); // Kalenderdaten neu laden
    } catch (error) {
        console.error("Fehler beim Löschen der Buchung:", error);
        alert("Buchung konnte nicht gelöscht werden.");
    }
  };

  // const handleCreateBooking = async (startDate, endDate) => { // This function is now replaced by handleModalSubmit
  //   if (!token) {
  //     alert("Bitte melden Sie sich an, um eine Buchung zu erstellen.");
  //     setSelectionStart(null); // Reset selection on auth error
  //     setSelectionEnd(null);
  //     return;
  //   }
  //   try {
  //     await axios.post(
  //       `${API_URL}/bookings`,
  //       { startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') },
  //       // Status would be added here if this function was kept
  //       { headers: { Authorization: `Bearer ${token}` } }
  //     );
  //     setDate(new Date(date.getTime())); // Refresh calendar data
  //     setSelectionStart(null); // Reset selection after successful booking
  //     setSelectionEnd(null);
  //   } catch (error) {
  //     console.error("Fehler beim Erstellen der Buchung:", error);
  //     alert(error.response?.data?.msg || "Buchung konnte nicht erstellt werden.");
  //     setSelectionStart(null); // Reset selection on booking error
  //     setSelectionEnd(null);
  //   }
  // };

  const dayPropGetter = (date) => {
    if (!selectionStart) {
      return {};
    }
    // Normalize date to remove time part for accurate comparison
    const normalizeDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const currentDate = normalizeDate(date);
    const normSelectionStart = normalizeDate(selectionStart);

    let style = {};
    if (selectionStart && !selectionEnd) { // Only start is selected, waiting for end
      if (currentDate.getTime() === normSelectionStart.getTime()) {
        style.backgroundColor = 'rgba(100, 100, 255, 0.3)'; // Light blue for start
        style.borderRadius = '5px';
      }
    } else if (selectionStart && selectionEnd) { // Both start and end are defined (during drag or after second click before booking)
      const normSelectionEnd = normalizeDate(selectionEnd);
      if (currentDate >= normSelectionStart && currentDate <= normSelectionEnd) {
        style.backgroundColor = 'rgba(173, 216, 230, 0.5)'; // Light blue for range
        if (currentDate.getTime() === normSelectionStart.getTime()) {
          style.borderTopLeftRadius = '5px';
          style.borderBottomLeftRadius = '5px';
        }
        if (currentDate.getTime() === normSelectionEnd.getTime()) {
          style.borderTopRightRadius = '5px';
          style.borderBottomRightRadius = '5px';
        }
      }
    }
    return { style };
  };

  const eventStyleGetter = (event) => {
    let style = {
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block',
      fontWeight: 'bold',
      cursor: (event.type === 'booking' && user && String(event.userId) === String(user.id)) ? 'pointer' : 'default',
    };
    switch (event.type) {
      case 'booking':
        // Default booking color (e.g., red for 'booked')
        style.backgroundColor = '#dc2626'; // Red for 'booked'
        style.fontWeight = 'bold';
        if (event.status === 'reserved') {
          style.backgroundColor = '#fdba74'; // Lighter orange for 'reserved'
          style.opacity = 0.7; // Reserved bookings are more transparent
          style.color = '#7c2d12'; // Darker text for better readability on light orange
          style.fontWeight = 'normal';
        }
        break;
      case 'publicHoliday':
        style.backgroundColor = '#2563eb'; // Blue
        break;
      case 'schoolHoliday':
        style.backgroundColor = '#16a34a'; // Green
        break;
      default:
        style.backgroundColor = '#64748b'; // Slate
        break;
    }
    return { style };
  };

  // --- RENDER ---
  if (!user) {
    return (
      <div className="bg-gray-200 w-screen h-screen p-8 flex justify-center items-center">
          {view === 'login' ? (
            <Login onLoginSuccess={handleLoginSuccess} setView={setView} />
          ) : (
            <Register setView={setView} />
          )}
      </div>
    );
  }

  return (
    <>
        {/* Hauptinhalts-Container mit vereinfachtem Layout */}
        <div className="p-4 md:p-8 h-screen flex flex-col bg-gray-50">
            <header className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold text-gray-800">Belegungskalender</h1>
                <div>
                    <span className="text-gray-700 mr-4">Angemeldet als: {user.displayName}</span>
                    <button onClick={handleLogout} className="px-4 py-2 font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Abmelden</button>
                </div>
            </header>
            <div className="flex-grow" ref={calendarRef}> {/* Attach ref here */}
                <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    selectable
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    culture='de'
                    date={date}
                    view={calendarView}
                    onNavigate={setDate}
                    onView={setCalendarView}
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
                    eventPropGetter={eventStyleGetter}
                    dayPropGetter={dayPropGetter} // Added dayPropGetter
                    onSelecting={handleSelecting} // Added onSelecting
                    // selectable={true} // Duplicate removed, already present above
                    style={{ height: '100%' }}
                />
            </div>
            {selectionStart && !selectionEnd && ( // Show message only when waiting for end date
                <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded text-center animate-pulse">
                    Startdatum ausgewählt: <strong>{format(selectionStart, 'dd.MM.yyyy')}</strong>. Bitte Enddatum auswählen oder Zeitraum ziehen.
                </div>
            )}
             {selectionStart && selectionEnd && ( // Show message when a period is selected
                <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-center">
                    Ausgewählter Zeitraum: <strong>{format(selectionStart, 'dd.MM.yyyy')}</strong> bis <strong>{format(selectionEnd, 'dd.MM.yyyy')}</strong>. Erneut klicken zum Bestätigen oder neues Startdatum wählen.
                </div>
            )}
        </div>

        <BookingConfirmationModal
            isOpen={showBookingModal}
            onClose={handleModalClose}
            onSubmit={handleModalSubmit}
            initialStartDate={modalStartDate}
            initialEndDate={modalEndDate}
        />

        {/* Das Modal wird jetzt mit der Portal-Komponente gerendert */}
        {selectedBooking && (
            <Modal>
                <div style={{backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem'}} className="shadow-xl max-w-md mx-4">
                    {!showConfirmDelete ? (
                        <>
                            <h3 className="text-xl font-bold mb-4">Details zu: {selectedBooking.status === 'reserved' ? 'Reservierung' : 'Buchung'}</h3>
                            <p><strong>Benutzer:</strong> {selectedBooking.displayName}</p>
                            <p><strong>Status:</strong> <span className={`font-semibold ${selectedBooking.status === 'reserved' ? 'text-orange-600' : 'text-red-600'}`}>
                                {selectedBooking.status === 'reserved' ? 'Reserviert' : 'Gebucht'}
                            </span></p>
                            <p><strong>Start:</strong> {format(selectedBooking.start, 'dd.MM.yyyy')}</p>
                            <p><strong>Ende:</strong> {format(selectedBooking.end, 'dd.MM.yyyy')}</p>
                            <div className="mt-6 flex justify-between items-center">
                                <div> {/* Container for status change buttons */}
                                    {selectedBooking.status === 'reserved' && (
                                        <button
                                            onClick={() => handleChangeBookingStatus(selectedBooking, 'booked')}
                                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 mr-2"
                                        >
                                            Zu Buchung ändern
                                        </button>
                                    )}
                                    {selectedBooking.status === 'booked' && (
                                        <button
                                            onClick={() => handleChangeBookingStatus(selectedBooking, 'reserved')}
                                            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 mr-2"
                                        >
                                            Zu Reservierung ändern
                                        </button>
                                    )}
                                </div>
                                <div className="flex space-x-4"> {/* Container for existing buttons */}
                                    <button onClick={() => setShowConfirmDelete(true)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Löschen</button>
                                    <button onClick={() => setSelectedBooking(null)} className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400">Schließen</button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 className="text-xl font-bold mb-4">Löschen bestätigen</h3>
                            <p>Möchten Sie diese {selectedBooking.status === 'reserved' ? 'Reservierung' : 'Buchung'} wirklich unwiderruflich löschen?</p>
                            <div className="mt-6 flex justify-end space-x-4">
                                <button onClick={handleDeleteBooking} className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800">Ja, löschen</button>
                                <button onClick={() => setShowConfirmDelete(false)} className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400">Nein, abbrechen</button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        )}
    </>
  );
}

export default App;
