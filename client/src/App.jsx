import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // Wichtig für die Portal-Funktion
import axios from 'axios';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import de from 'date-fns/locale/de';
import subDays from 'date-fns/subDays';

// Helper function to check if two dates are the same day
const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

// Custom Date Header Component
const CustomDateHeader = ({ date, label, allEvents }) => {
  // Ensure allEvents is an array and date is valid before processing
  const publicHolidays = Array.isArray(allEvents) ? allEvents.filter(event =>
    event.type === 'publicHoliday' && event.start && isSameDay(new Date(event.start), date)
  ) : [];

  let holidayDisplaySpan = null;
  if (publicHolidays.length > 0) {
    // Display the full title of the first public holiday
    const fullHolidayTitle = publicHolidays[0].title;
    // Tooltip will show all holidays if there are multiple on the same day
    const tooltipTitle = publicHolidays.map(h => h.title).join(', ');

    // Get the computed style for public holiday text color
    const publicHolidayTextColor = getComputedStyle(document.documentElement).getPropertyValue('--public-holiday-text-color').trim() || '#ffffff';
    // Fallback to the background color if text color is not contrasting enough (simple heuristic)
    // This is a very basic check; a proper contrast check is more complex.
    // For now, we assume the user picks a contrasting text color.
    // The publicHolidayColor is used for the day background tint, not directly here.

    holidayDisplaySpan = (
      <span
        className="text-xs whitespace-normal"
        style={{ color: publicHolidayTextColor, opacity: 0.9 }} // Use dedicated text color
        title={tooltipTitle}
      >
        {fullHolidayTitle}
      </span>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden pt-1">
      {/* Date label takes its natural space at the top */}
      <span className="rbc-date-cell-label self-start">{label}</span> {/* Ensure date is at the start (left) */}

      {holidayDisplaySpan && (
        // This div will take the remaining space and center its content (the holiday name)
        <div
          className="flex-grow flex items-center justify-center text-center overflow-hidden"
          style={{ minHeight: 0 }} // Important for flex-grow in some scenarios
        >
          <div style={{ maxHeight: '2.8em' }}> {/* Max height for holiday text area, allowing up to 2 lines approx */}
            {holidayDisplaySpan}
          </div>
        </div>
      )}
    </div>
  );
};

// Komponenten importieren
import Login from './components/Login';
import Register from './components/Register';
import BookingConfirmationModal from './components/BookingConfirmationModal'; // Import new modal
import Settings from './components/Settings'; // Import Settings component

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
  const [user, setUser] = useState(null); // User object, will include isAdmin
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [view, setView] = useState('login'); // Can be 'login', 'register', 'calendar', 'settings'
  const [appView, setAppView] = useState('calendar'); // 'calendar' or 'settings'
  const [allUsers, setAllUsers] = useState([]); // For admin to select user

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
    // Load settings from localStorage on initial app load
    const initialPageTitle = localStorage.getItem('pageTitle') || 'Belegungskalender';
    document.title = initialPageTitle;

    const primaryColor = localStorage.getItem('primaryColor') || '#2563eb';
    document.documentElement.style.setProperty('--primary-color', primaryColor);

    const secondaryColor = localStorage.getItem('secondaryColor') || '#dc2626';
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);

    const backgroundColor = localStorage.getItem('backgroundColor') || '#f9fafb'; // Default gray-50
    document.documentElement.style.setProperty('--background-color', backgroundColor);
    document.body.style.backgroundColor = backgroundColor;
    const backgroundColorText = localStorage.getItem('backgroundColorText') || '#111827';
    document.documentElement.style.setProperty('--background-text-color', backgroundColorText);
    document.body.style.color = backgroundColorText; // Apply global text color based on background

    // Load calendar event colors & text colors
    const publicHolidayColor = localStorage.getItem('publicHolidayColor') || '#2563eb';
    document.documentElement.style.setProperty('--public-holiday-color', publicHolidayColor);
    const publicHolidayTextColor = localStorage.getItem('publicHolidayTextColor') || '#ffffff';
    document.documentElement.style.setProperty('--public-holiday-text-color', publicHolidayTextColor);

    const schoolHolidayColor = localStorage.getItem('schoolHolidayColor') || '#a8a29e';
    document.documentElement.style.setProperty('--school-holiday-color', schoolHolidayColor);
    const schoolHolidayTextColor = localStorage.getItem('schoolHolidayTextColor') || '#ffffff';
    document.documentElement.style.setProperty('--school-holiday-text-color', schoolHolidayTextColor);

    const bookedColor = localStorage.getItem('bookedColor') || '#dc2626';
    document.documentElement.style.setProperty('--booked-color', bookedColor);
    const bookedTextColor = localStorage.getItem('bookedTextColor') || '#ffffff';
    document.documentElement.style.setProperty('--booked-text-color', bookedTextColor);

    // Text colors for primary and secondary already loaded in Settings.jsx and set as CSS vars.
    // We need to ensure App.jsx also loads them for elements it controls directly if not covered by Settings.
    const primaryTextColor = localStorage.getItem('primaryTextColor') || '#ffffff';
    document.documentElement.style.setProperty('--primary-text-color', primaryTextColor);
    const secondaryTextColor = localStorage.getItem('secondaryTextColor') || '#ffffff';
    document.documentElement.style.setProperty('--secondary-text-color', secondaryTextColor);


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

        const bookingsPromise = axios.get(`${API_URL}/bookings`);
        const publicHolidaysPromise = axios.get(`${API_URL}/holidays/public/HE?year=${year}`);
        const schoolHolidaysPromise = axios.get(`${API_URL}/holidays/school/HE?year=${year}`)
          .catch(error => {
            console.warn(`Warning: Failed to load school holidays for year ${year}. Displaying calendar without them. Error:`, error.message);
            return { data: [] }; // Return an empty array structure to prevent downstream errors
          });

        const [bookingsRes, publicHolidaysRes, schoolHolidaysRes] = await Promise.all([
          bookingsPromise,
          publicHolidaysPromise,
          schoolHolidaysPromise // This will now resolve with { data: [] } if the original fetch failed
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

        const allEvents = [...formattedBookings, ...formattedPublicHolidays, ...formattedSchoolHolidays];

        // Sort events: public holidays first, then bookings, then school holidays
        allEvents.sort((a, b) => {
          const typeOrder = {
            publicHoliday: 1,
            booking: 2, // Assuming 'booking' is the type for bookings
            schoolHoliday: 3,
          };

          const orderA = typeOrder[a.type] || 99; // Default for unknown types
          const orderB = typeOrder[b.type] || 99;

          if (orderA !== orderB) {
            return orderA - orderB;
          }

          // Optional: secondary sort by start date if types are the same
          return new Date(a.start) - new Date(b.start);
        });

        setEvents(allEvents);
      } catch (error) {
        console.error("Fehler beim Laden der Kalenderdaten:", error);
      }
    };

    fetchAllEvents();
  }, [date, user]);

  // Fetch all users if the current user is an admin
  useEffect(() => {
    const fetchAllUsers = async () => {
      if (user && user.isAdmin && token) {
        try {
          const response = await axios.get(`${API_URL}/users`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setAllUsers(response.data);
        } catch (error) {
          console.error('Fehler beim Laden aller Benutzer:', error);
          // Optionally, set an error state or show a notification
        }
      } else {
        setAllUsers([]); // Clear if not admin or no token
      }
    };

    fetchAllUsers();
  }, [user, token]);

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
    setAppView('calendar'); // After login, show calendar
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setView('login'); // Go back to login screen
    setAppView('calendar'); // Reset app view
  };

  const handleUpdateUser = async (updatedUser) => {
    // This function would ideally call an API to update user data on the server
    // For now, it updates the local state and localStorage
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    // Potentially, re-fetch bookings if displayName change affects them, or update in-memory events
    // For now, assume displayName changes are reflected on next full fetch or are minor.
  };

  const handleSelectSlot = ({ start, end, action }) => {
    if (ignoreNextCalendarClick) {
      setIgnoreNextCalendarClick(false); // Reset the flag
      return;
    }

    if (action === 'select') { // User finished a drag operation
      const inclusiveEndDate = subDays(end, 1); // Adjust for exclusive end date
      setSelectionStart(start);
      setSelectionEnd(inclusiveEndDate);
      // Open the modal directly for the dragged selection
      setModalStartDate(start);
      setModalEndDate(inclusiveEndDate);
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

  const handleModalSubmit = async (newStartDate, newEndDate, type, selectedUserIdForBooking) => {
    if (!token) {
      alert("Bitte melden Sie sich an.");
      setShowBookingModal(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      setIgnoreNextCalendarClick(true);
      setTimeout(() => setIgnoreNextCalendarClick(false), 50);
      return;
    }

    const payload = {
      startDate: format(newStartDate, 'yyyy-MM-dd'),
      endDate: format(newEndDate, 'yyyy-MM-dd'),
      status: type,
    };

    if (user && user.isAdmin && selectedUserIdForBooking) {
      const targetUser = allUsers.find(u => u.id === parseInt(selectedUserIdForBooking));
      if (targetUser) {
        payload.userId = targetUser.id;
        // backend will use displayName from this targetUser.id, so no need to send displayName
        // payload.displayName = targetUser.displayName; // Not strictly needed if backend fetches based on userId
      } else if (selectedUserIdForBooking !== user.id.toString()){ // if admin selected a user but user not found (error)
        alert("Ausgewählter Benutzer nicht gefunden. Buchung wird für Sie selbst erstellt.");
        // Fallback to booking for admin themselves if selected user is invalid and not the admin
      }
      // If selectedUserIdForBooking is the admin's own ID, or no user selected, it books for the admin.
    }

    try {
      await axios.post(`${API_URL}/bookings`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowBookingModal(false);
      setDate(new Date(date.getTime()));
      setSelectionStart(null); // Clear selection after successful booking/reservation
      setSelectionEnd(null);   // Clear selection after successful booking/reservation
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
  setSelectionStart(null); // Clear selection when modal is closed
  setSelectionEnd(null);   // Clear selection when modal is closed
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

const handleUpdateBookingAdmin = async () => {
  if (!token || !selectedBooking || !(user && user.isAdmin)) {
    alert("Aktion nicht möglich oder nicht autorisiert.");
    return;
  }
  try {
    const payload = {
      startDate: format(selectedBooking.start, 'yyyy-MM-dd'),
      endDate: format(selectedBooking.end, 'yyyy-MM-dd'),
      status: selectedBooking.status,
      userId: selectedBooking.userId, // Send the potentially changed userId
      // displayName will be derived by the backend based on userId
    };

    await axios.put(
      `${API_URL}/bookings/${selectedBooking.id}`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setSelectedBooking(null); // Close the detail modal
    setDate(new Date(date.getTime())); // Refresh calendar data to show changes
    // Or, more efficiently, update the event in the local 'events' state
  } catch (error) {
    console.error(`Fehler beim Aktualisieren der Buchung (Admin):`, error);
    alert(error.response?.data?.msg || "Buchung konnte nicht aktualisiert werden.");
    // Keep detail modal open on error, allowing user to correct or retry
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
    // Admins can select any booking, others only their own.
    if (event && event.type === 'booking' && user) {
      if (user.isAdmin || String(event.userId) === String(user.id)) {
        setSelectedBooking(event);
        setShowConfirmDelete(false); // Reset confirmation view
      }
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
    // Normalize date to remove time part for accurate comparison
    const normalizeDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const currentDate = normalizeDate(date);
    let style = {};
    const docStyle = getComputedStyle(document.documentElement);

    // Helper function to convert hex to rgba
    const hexToRgba = (hex, alpha) => {
        if (!hex || !hex.startsWith('#')) return `rgba(200,200,200,${alpha})`; // Fallback for invalid hex
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Check for public holidays
    const isPublicHoliday = events.some(event => {
        if (event.type === 'publicHoliday') {
            const holidayStart = normalizeDate(new Date(event.start));
            // public holidays are single days, so end date is same as start
            return currentDate.getTime() === holidayStart.getTime();
        }
        return false;
    });

    // Check for school holidays
    const isSchoolHoliday = events.some(event => {
        if (event.type === 'schoolHoliday') {
            const holidayStart = normalizeDate(new Date(event.start));
            const holidayEnd = normalizeDate(new Date(event.end));
            return currentDate >= holidayStart && currentDate <= holidayEnd;
        }
        return false;
    });

    if (isPublicHoliday) {
        const publicHolidayBgColor = docStyle.getPropertyValue('--public-holiday-color').trim() || '#2563eb';
        // Apply with some transparency to differentiate from event block
        style.backgroundColor = hexToRgba(publicHolidayBgColor, 0.3);
    }
    // Removed the 'else if (isSchoolHoliday)' block to prevent school holiday day background coloring.
    // School holiday event blocks will still be colored by eventStyleGetter.

    // Apply selection styling - this will override holiday background if a day is selected
    if (selectionStart) {
      const normSelectionStart = normalizeDate(selectionStart);
      if (selectionStart && !selectionEnd) { // Only start is selected, waiting for end
        if (currentDate.getTime() === normSelectionStart.getTime()) {
          style.backgroundColor = 'rgba(250, 204, 21, 0.4)'; // Yellow for start (Tailwind yellow-400 at 40% opacity)
          style.borderRadius = '5px';
        }
      } else if (selectionStart && selectionEnd) { // Both start and end are defined
        const normSelectionEnd = normalizeDate(selectionEnd);
        if (currentDate >= normSelectionStart && currentDate <= normSelectionEnd) {
          style.backgroundColor = 'rgba(250, 204, 21, 0.6)'; // More opaque Yellow for range (Tailwind yellow-400 at 60% opacity)
          if (currentDate.getTime() === normSelectionStart.getTime()) {
            style.borderTopLeftRadius = '5px';
            style.borderBottomLeftRadius = '5px';
          }
          if (currentDate.getTime() === normSelectionEnd.getTime()) {
            style.borderTopRightRadius = '5px';
            style.borderBottomRightRadius = '5px';
          }
          // Ensure continuous selection appearance if holiday and selection overlap
          if (isPublicHoliday || isSchoolHoliday) { // Check against the specific holiday types
             // Make selection more prominent on holidays
            style.boxShadow = 'inset 0 0 0 2px rgba(245, 158, 11, 0.7)'; // Tailwind yellow-500 border inset
          }
        }
      }
    }
    return { style };
  };

  const eventStyleGetter = (event) => {
    let style = {
      borderRadius: '5px',
      // opacity: 0.8, // Default opacity for events - will be handled by specific types or RGBA alpha
      border: '0px',
      display: 'block',
      fontWeight: 'bold',
      // Admins can click any booking, users only their own.
      cursor: (event.type === 'booking' && user && (user.isAdmin || String(event.userId) === String(user.id))) ? 'pointer' : 'default',
    };

    const docStyle = getComputedStyle(document.documentElement);

    // Helper function to convert hex to rgba
    const hexToRgba = (hex, alpha) => {
      if (!hex || !hex.startsWith('#')) return `rgba(100,100,100,${alpha})`; // Fallback for invalid hex
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const bookedBaseColor = docStyle.getPropertyValue('--booked-color').trim() || '#dc2626';

    switch (event.type) {
      case 'booking':
        style.backgroundColor = bookedBaseColor;
        style.color = docStyle.getPropertyValue('--booked-text-color').trim() || '#ffffff';
        style.opacity = 0.9; // Slightly more opaque for main bookings

        if (event.status === 'reserved') {
          style.backgroundColor = hexToRgba(bookedBaseColor, 0.6); // 40% transparency
          // For reserved, explicitly use a contrasting text color, or inherit from bookedTextColor and hope for the best.
          // Using bookedTextColor might be fine if it's generally chosen to contrast with bookedBaseColor.
          // If bookedTextColor is light, and bookedBaseColor is light, this could be an issue.
          // For now, let's use bookedTextColor, assuming user configures it well.
          style.color = docStyle.getPropertyValue('--booked-text-color').trim() || '#111827'; // Fallback to dark if not set
          style.fontWeight = 'normal';
          style.opacity = 0.75; // Slightly more transparent for reserved
        }
        break;
      case 'publicHoliday':
        style.backgroundColor = docStyle.getPropertyValue('--public-holiday-color').trim() || '#2563eb';
        style.color = docStyle.getPropertyValue('--public-holiday-text-color').trim() || '#ffffff';
        style.zIndex = 10;
        style.opacity = 0.9;
        break;
      case 'schoolHoliday':
        style.backgroundColor = docStyle.getPropertyValue('--school-holiday-color').trim() || '#a8a29e';
        style.color = docStyle.getPropertyValue('--school-holiday-text-color').trim() || '#1f2937'; // Default dark text
        style.border = `1px solid ${hexToRgba(docStyle.getPropertyValue('--school-holiday-color').trim() || '#a8a29e', 0.5)}`;
        style.opacity = 0.85;
        break;
      default:
        style.backgroundColor = '#64748b'; // Slate as a fallback
        style.color = '#ffffff';
        style.opacity = 0.8;
        break;
    }
    return { style };
  };

  // --- RENDER ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
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
      <div
        className="p-4 md:p-8 h-screen flex flex-col max-w-full mx-auto" // Use max-w-full for full width
        style={{ backgroundColor: 'var(--background-color)' }}
      >
        <header className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b border-gray-300">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--primary-color)' }}>
            {localStorage.getItem('pageTitle') || 'Belegungskalender'}
          </h1>
          <div className="flex items-center space-x-3 mt-2 md:mt-0">
            <span className="text-sm font-medium mr-4" style={{ color: 'var(--background-text-color)' }}>
              {/* Added mr-4 for right margin */}
              Angemeldet als: {user.displayName}
            </span>
            <button
              onClick={() => setAppView(appView === 'calendar' ? 'settings' : 'calendar')}
              className="btn btn-primary" // Apply global button style
              // Removed inline style, relying on btn-primary from index.css or custom var if needed
            >
              {appView === 'calendar' ? 'Einstellungen' : 'Kalender'}
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-secondary" // Apply global button style
               // Removed inline style, relying on btn-secondary from index.css or custom var if needed
            >
              Abmelden
            </button>
          </div>
        </header>

        {appView === 'calendar' && (
          <div className="flex-grow card-custom p-0 overflow-hidden" ref={calendarRef}> {/* Apply card style, remove padding for calendar */}
            <Calendar
              localizer={localizer}
              events={events.filter(event => event.type !== 'publicHoliday')}
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
              dayPropGetter={dayPropGetter}
              onSelecting={handleSelecting}
              components={{
                month: { dateHeader: (props) => <CustomDateHeader {...props} allEvents={events} /> }
              }}
              style={{ height: '100%' }} // Calendar itself needs height 100%
              className="rounded-lg" // Ensure calendar corners are rounded if card has padding
            />
          </div>
        )}

        {appView === 'settings' && (
          <div className="card-custom"> {/* Wrap settings in a card */}
            <Settings user={user} onUpdateUser={handleUpdateUser} />
          </div>
        )}

        {appView === 'calendar' && selectionStart && !selectionEnd && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded text-center animate-pulse">
            Startdatum ausgewählt: <strong>{format(selectionStart, 'dd.MM.yyyy')}</strong>. Bitte Enddatum auswählen oder Zeitraum ziehen.
          </div>
        )}
        {appView === 'calendar' && selectionStart && selectionEnd && (
          <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-center">
            Ausgewählter Zeitraum: <strong>{format(selectionStart, 'dd.MM.yyyy')}</strong> bis <strong>{format(selectionEnd, 'dd.MM.yyyy')}</strong>.
          </div>
        )}
      </div>

      {appView === 'calendar' && <BookingConfirmationModal
        isOpen={showBookingModal}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        initialStartDate={modalStartDate}
        initialEndDate={modalEndDate}
         currentUser={user} // Pass current user (contains isAdmin)
         allUsers={allUsers} // Pass all users for admin dropdown
      />}

      {appView === 'calendar' && selectedBooking && (
        <Modal>
          {/* Changed max-w-md to max-w-xl for admin edit view, kept max-w-md for user view and delete confirmation */}
          <div className={`card-custom mx-4 ${user && user.isAdmin && !showConfirmDelete ? 'max-w-xl' : 'max-w-md'}`}>
            {!showConfirmDelete ? (
              <>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">Details zu: {selectedBooking.status === 'reserved' ? 'Reservierung' : 'Buchung'}</h3>
                {/* Admin-specific editing fields */}
                {user && user.isAdmin ? (
                  <>
                    <div className="mb-4">
                      <label htmlFor="editBookingUser" className="block text-sm font-medium text-gray-700 mb-1">Benutzer:</label>
                      <select
                        id="editBookingUser"
                        className="input-field"
                        value={selectedBooking.userId.toString()} // Assuming selectedBooking has userId
                        onChange={(e) => setSelectedBooking(prev => ({ ...prev, userId: parseInt(e.target.value), displayName: allUsers.find(u => u.id === parseInt(e.target.value))?.displayName || prev.displayName }))}
                      >
                        {allUsers.map(u => <option key={u.id} value={u.id.toString()}>{u.displayName}</option>)}
                      </select>
                    </div>
                    <div className="mb-4">
                      <label htmlFor="editBookingStartDate" className="block text-sm font-medium text-gray-700 mb-1">Startdatum:</label>
                      <input
                        type="date"
                        id="editBookingStartDate"
                        className="input-field"
                        value={format(selectedBooking.start, 'yyyy-MM-dd')}
                        onChange={(e) => setSelectedBooking(prev => ({ ...prev, start: new Date(e.target.value) }))}
                      />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="editBookingEndDate" className="block text-sm font-medium text-gray-700 mb-1">Enddatum:</label>
                      <input
                        type="date"
                        id="editBookingEndDate"
                        className="input-field"
                        value={format(selectedBooking.end, 'yyyy-MM-dd')}
                        onChange={(e) => setSelectedBooking(prev => ({ ...prev, end: new Date(e.target.value) }))}
                      />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="editBookingStatus" className="block text-sm font-medium text-gray-700 mb-1">Status:</label>
                      <select
                        id="editBookingStatus"
                        className="input-field"
                        value={selectedBooking.status}
                        onChange={(e) => setSelectedBooking(prev => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="booked">Gebucht</option>
                        <option value="reserved">Reserviert</option>
                      </select>
                    </div>
                    <div className="mt-6 flex justify-end space-x-2">
                      <button onClick={() => handleUpdateBookingAdmin()} className="btn btn-primary">Änderungen speichern</button>
                      <button onClick={() => setShowConfirmDelete(true)} className="btn bg-red-600 hover:bg-red-700 text-white">Löschen</button>
                      <button onClick={() => { setSelectedBooking(null); fetchAllEvents(); /* Refetch to discard local changes */ }} className="btn btn-secondary">Schließen</button>
                    </div>
                  </>
                ) : (
                  // Regular user view (existing logic)
                  <>
                    <p className="mb-2"><strong>Benutzer:</strong> {selectedBooking.displayName}</p>
                    <p className="mb-2"><strong>Status:</strong> <span className={`font-semibold ${selectedBooking.status === 'reserved' ? 'text-yellow-600' : 'text-red-700'}`}>
                      {selectedBooking.status === 'reserved' ? 'Reserviert' : 'Gebucht'}
                    </span></p>
                    <p className="mb-2"><strong>Start:</strong> {format(selectedBooking.start, 'dd.MM.yyyy')}</p>
                    <p className="mb-4"><strong>Ende:</strong> {format(selectedBooking.end, 'dd.MM.yyyy')}</p>
                    <div className="mt-6 flex flex-wrap justify-between items-center gap-2">
                      <div>
                        {selectedBooking.status === 'reserved' && (
                          <button
                            onClick={() => handleChangeBookingStatus(selectedBooking, 'booked')}
                            className="btn bg-green-500 hover:bg-green-600 text-white"
                          >
                            Zu Buchung ändern
                          </button>
                        )}
                        {selectedBooking.status === 'booked' && (
                          <button
                            onClick={() => handleChangeBookingStatus(selectedBooking, 'reserved')}
                            className="btn bg-yellow-500 hover:bg-yellow-600 text-white"
                          >
                            Zu Reservierung ändern
                          </button>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => setShowConfirmDelete(true)} className="btn bg-red-600 hover:bg-red-700 text-white">Löschen</button>
                        <button onClick={() => setSelectedBooking(null)} className="btn btn-secondary">Schließen</button>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold mb-4 text-gray-800">Löschen bestätigen</h3>
                <p className="mb-6">Möchten Sie diese {selectedBooking.status === 'reserved' ? 'Reservierung' : 'Buchung'} wirklich unwiderruflich löschen?</p>
                <div className="mt-6 flex justify-end space-x-3">
                  <button onClick={handleDeleteBooking} className="btn bg-red-700 hover:bg-red-800 text-white">Ja, löschen</button>
                  <button onClick={() => setShowConfirmDelete(false)} className="btn btn-secondary">Nein, abbrechen</button>
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
