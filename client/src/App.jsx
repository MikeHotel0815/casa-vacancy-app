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
import AdminLayout from './components/Admin/AdminLayout'; // Import AdminLayout

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
  // const [view, setView] = useState('login'); // 'view' state for login/register will be implicitly handled by user state
  const [currentMainView, setCurrentMainView] = useState('calendar'); // 'calendar', 'settings', 'admin'
  const [allUsers, setAllUsers] = useState([]); // For admin to select user

  // --- CALENDAR & MODAL STATES ---
  const [events, setEvents] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null); // Added to store the end of the selection range
  const [date, setDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState(Views.MONTH);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [userNotifications, setUserNotifications] = useState([]);
  const [relevantNotificationForModal, setRelevantNotificationForModal] = useState(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const notificationsButtonRef = useRef(null); // Ref for the notifications button
  const notificationsDropdownRef = useRef(null); // Ref for the notifications dropdown


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

        const formattedBookings = bookingsRes.data.map(booking => {
          let titlePrefix = 'Belegt';
          if (booking.status === 'reserved') titlePrefix = 'Reserviert';
          else if (booking.status === 'angefragt') titlePrefix = 'Angefragt';
          else if (booking.status === 'cancelled') titlePrefix = 'Storniert';

          return {
            id: booking.id,
            userId: booking.userId,
            title: `${titlePrefix}: ${booking.displayName}`,
            displayName: booking.displayName, // Store displayName separately for modal use
            start: new Date(booking.startDate),
            end: new Date(booking.endDate),
            type: 'booking',
            status: booking.status,
          };
        });
        // const formattedPublicHolidays = publicHolidaysRes.data.map(holiday => ({ // This was the duplicated line
        //   title: holiday.localName,
        //   start: new Date(holiday.date),
        //   end: new Date(holiday.date),
        //   allDay: true,
        //   type: 'booking', // This was also incorrect, should be 'publicHoliday'
        //   status: booking.status, // And this was incorrect context
        // }));
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
  }, [date, user, token]); // Added token dependency for fetchAllEvents if it starts using it for notifications indirectly

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
        }
      } else {
        setAllUsers([]);
      }
    };
    fetchAllUsers();
  }, [user, token]);

  // Fetch notifications for the logged-in user
  useEffect(() => {
    const fetchUserNotifications = async () => {
      if (user && token) {
        try {
          const response = await axios.get(`${API_URL}/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUserNotifications(response.data);
        } catch (error) {
          console.error('Fehler beim Laden der Benachrichtigungen:', error);
        }
      } else {
        setUserNotifications([]);
      }
    };
    fetchUserNotifications();
    // Re-fetch notifications when date changes as actions might have occurred
    // or when selectedBooking changes to check for relevant notifications for the modal.
  }, [user, token, date]); // Removed selectedBooking from deps, handled by its own effect


  useEffect(() => {
    if (selectedBooking && selectedBooking.status === 'angefragt' && user) {
      const relevantNotif = userNotifications.find(
        (n) =>
          n.type === 'overlap_request' &&
          n.relatedBookingId === selectedBooking.id &&
          n.recipientUserId === user.id &&
          n.response === 'pending'
      );
      setRelevantNotificationForModal(relevantNotif || null);
    } else {
      setRelevantNotificationForModal(null);
    }
  }, [selectedBooking, userNotifications, user]);


  useEffect(() => {
    const handleClickOutside = (event) => {
      // Handle clicks outside calendar to clear selection
      if (!showBookingModal && calendarRef.current && !calendarRef.current.contains(event.target)) {
        if (selectionStart || selectionEnd) {
          setSelectionStart(null);
          setSelectionEnd(null);
        }
      }

      // Handle clicks outside notifications dropdown to close it
      if (showNotificationsDropdown &&
          notificationsButtonRef.current && !notificationsButtonRef.current.contains(event.target) &&
          notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(event.target)) {
        setShowNotificationsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [calendarRef, showBookingModal, selectionStart, selectionEnd, showNotificationsDropdown]);

  // --- HANDLER FUNCTIONS ---
  const handleLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setCurrentMainView('calendar'); // After login, show calendar
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    // No need to setView, as the !user condition will render Login/Register
    setCurrentMainView('calendar'); // Reset main view to calendar for next login
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

const handleRespondToOverlap = async (notificationId, responseAction) => {
  if (!token || !notificationId) {
    alert("Aktion nicht möglich. Benachrichtigung nicht gefunden oder nicht angemeldet.");
    return;
  }
  try {
    await axios.post(
      `${API_URL}/notifications/${notificationId}/respond`,
      { action: responseAction }, // 'approved' or 'rejected'
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // Refresh data and close modal
    setDate(new Date(date.getTime())); // Triggers re-fetch of events & notifications
    setSelectedBooking(null);
    setRelevantNotificationForModal(null);
    // Optionally, provide specific feedback to the user
    alert(`Aktion '${responseAction === 'approved' ? 'Zustimmung' : 'Ablehnung'}' erfolgreich durchgeführt.`);
  } catch (error) {
    console.error(`Fehler beim Antworten auf Überschneidungsanfrage:`, error);
    alert(error.response?.data?.msg || "Aktion konnte nicht durchgeführt werden.");
    // Keep modal open if error occurs, user might want to retry or see context
  }
};

const handleMarkNotificationAsRead = async (notificationId) => {
  if (!token || !notificationId) return;
  try {
    await axios.post(
      `${API_URL}/notifications/${notificationId}/mark-read`,
      {}, // Empty body
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setUserNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  } catch (error) {
    console.error("Fehler beim Markieren der Benachrichtigung als gelesen:", error);
    // No alert to user, as this is a background action mostly.
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

    const bookedBaseColor = docStyle.getPropertyValue('--booked-color').trim() || '#dc2626'; // Red-600
    const bookedTextColor = docStyle.getPropertyValue('--booked-text-color').trim() || '#ffffff';
    const angefragtColor = docStyle.getPropertyValue('--angefragt-color') || '#fbbf24'; // Tailwind amber-400
    const angefragtTextColor = docStyle.getPropertyValue('--angefragt-text-color') || '#422006'; // Darker text for amber
    const cancelledColor = docStyle.getPropertyValue('--cancelled-color') || '#9ca3af'; // Tailwind gray-400
    const cancelledTextColor = docStyle.getPropertyValue('--cancelled-text-color') || '#4b5563'; // Tailwind gray-600


    switch (event.type) {
      case 'booking':
        switch (event.status) {
          case 'booked':
            style.backgroundColor = bookedBaseColor;
            style.color = bookedTextColor;
            style.opacity = 0.9;
            // Check if this 'booked' event is being overlapped by a pending request
            const isBookedAndOverlapped = userNotifications.some(n => {
              return (
                n.type === 'overlap_request' &&
                n.response === 'pending' &&
                n.recipientUserId === user?.id &&
                n.relatedBooking && // Ensure relatedBooking exists
                n.relatedBooking.originalBookingId === event.id
              );
            });
            if (isBookedAndOverlapped) {
              // TEST STYLING:
              style.border = `5px solid limegreen`;
              style.backgroundColor = 'red'; // Should be very obvious
              style.boxShadow = `0 0 10px yellow`;
            }
            break;
          case 'reserved':
            style.backgroundColor = hexToRgba(bookedBaseColor, 0.6);
            style.color = bookedTextColor;
            style.fontWeight = 'normal';
            style.opacity = 0.75;
            // Check if this 'reserved' event is being overlapped
            const isReservedAndOverlapped = userNotifications.some(n => {
              return (
                n.type === 'overlap_request' &&
                n.response === 'pending' &&
                n.recipientUserId === user?.id &&
                n.relatedBooking &&
                n.relatedBooking.originalBookingId === event.id
              );
            });
            if (isReservedAndOverlapped) {
              // TEST STYLING:
              style.border = `5px solid limegreen`;
              style.backgroundColor = 'red'; // Should be very obvious
              style.boxShadow = `0 0 10px yellow`;
            }
            break;
          case 'angefragt':
            style.backgroundColor = angefragtColor;
            style.color = angefragtTextColor;
            style.opacity = 0.8;
            // Optional: Add a striped background for 'angefragt'
            style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)';
            break;
          case 'cancelled':
            style.backgroundColor = cancelledColor;
            style.color = cancelledTextColor;
            style.textDecoration = 'line-through';
            style.opacity = 0.6;
            // For cancelled bookings, we might not want them to be clickable or as prominent.
            // The filter in fetchAllEvents might already remove them, or they can be styled to be less intrusive.
            // If they are still passed to the calendar, ensure cursor is default.
            style.cursor = 'default';
            break;
          default: // Should not happen if status is always one of the above
            style.backgroundColor = '#64748b'; // Slate fallback
            style.color = '#ffffff';
            style.opacity = 0.8;
            break;
        }
        break;
      case 'publicHoliday':
        style.backgroundColor = docStyle.getPropertyValue('--public-holiday-color').trim() || '#2563eb'; // Blue-600
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
  const [loginRegisterView, setLoginRegisterView] = useState('login'); // 'login' or 'register'

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        {loginRegisterView === 'login' ? (
          <Login onLoginSuccess={handleLoginSuccess} setView={setLoginRegisterView} />
        ) : (
          <Register setView={setLoginRegisterView} />
        )}
      </div>
    );
  }

  // If user is logged in, decide which main view to show
  if (currentMainView === 'admin') {
    return <AdminLayout
              currentUser={user}
              onLogout={handleLogout}
              navigateToCalendar={() => setCurrentMainView('calendar')}
           />;
  }

  // Default view for logged-in user (calendar or settings)
  return (
    <>
      <div
        className="p-4 md:p-8 h-screen flex flex-col max-w-full mx-auto"
        style={{ backgroundColor: 'var(--background-color)' }}
      >
        <header className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b border-gray-300">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--primary-color)' }}>
            {localStorage.getItem('pageTitle') || 'Belegungskalender'}
          </h1>
          <div className="flex items-center space-x-3 mt-2 md:mt-0">
            <span className="text-sm font-medium mr-4" style={{ color: 'var(--background-text-color)' }}>
              Angemeldet als: {user.displayName}
            </span>

            {/* Notifications Bell Icon & Dropdown */}
            <div className="relative" ref={notificationsButtonRef}>
              <button
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="btn p-2 relative"
                aria-label="Benachrichtigungen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {userNotifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute top-0 right-0 block h-4 w-4 transform -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {userNotifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </button>
              {showNotificationsDropdown && (
                <div ref={notificationsDropdownRef} className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg z-20">
                  {userNotifications.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">Keine neuen Benachrichtigungen.</p>
                  ) : (
                    <ul>
                      {userNotifications.map(notification => (
                        <li
                          key={notification.id}
                          className={`p-3 border-b border-gray-200 hover:bg-gray-50 ${!notification.isRead ? 'font-semibold bg-blue-50' : ''}`}
                          onClick={() => !notification.isRead && handleMarkNotificationAsRead(notification.id)}
                        >
                          <p className="text-sm text-gray-700 mb-1">{notification.message}</p>
                          <p className="text-xs text-gray-500">{format(new Date(notification.createdAt), 'dd.MM.yyyy HH:mm')}</p>
                          {notification.type === 'overlap_request' && notification.response === 'pending' && (
                            <div className="mt-2 flex space-x-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRespondToOverlap(notification.id, 'approved'); setShowNotificationsDropdown(false);}}
                                className="btn bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1">
                                Zustimmen
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRespondToOverlap(notification.id, 'rejected'); setShowNotificationsDropdown(false);}}
                                className="btn bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1">
                                Ablehnen
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {user.isAdmin && (
              <button
                onClick={() => setCurrentMainView('admin')}
                className="btn btn-accent" // Use a distinct color for Admin button
              >
                Admin Panel
              </button>
            )}
            <button
              onClick={() => setCurrentMainView(currentMainView === 'calendar' ? 'settings' : 'calendar')}
              className="btn btn-primary"
            >
              {currentMainView === 'calendar' ? 'Einstellungen' : 'Kalender'}
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
            >
              Abmelden
            </button>
          </div>
        </header>

        {currentMainView === 'calendar' && (
          <div className="flex-grow card-custom p-0 overflow-hidden" ref={calendarRef}>
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
              style={{ height: '100%' }}
              className="rounded-lg"
            />
          </div>
        )}

        {currentMainView === 'settings' && (
          <div className="card-custom">
            <Settings user={user} onUpdateUser={handleUpdateUser} />
          </div>
        )}

        {currentMainView === 'calendar' && selectionStart && !selectionEnd && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded text-center animate-pulse">
            Startdatum ausgewählt: <strong>{format(selectionStart, 'dd.MM.yyyy')}</strong>. Bitte Enddatum auswählen oder Zeitraum ziehen.
          </div>
        )}
        {currentMainView === 'calendar' && selectionStart && selectionEnd && (
          <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-center">
            Ausgewählter Zeitraum: <strong>{format(selectionStart, 'dd.MM.yyyy')}</strong> bis <strong>{format(selectionEnd, 'dd.MM.yyyy')}</strong>.
          </div>
        )}
      </div>

      {currentMainView === 'calendar' && <BookingConfirmationModal
        isOpen={showBookingModal}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        initialStartDate={modalStartDate}
        initialEndDate={modalEndDate}
         currentUser={user}
         allUsers={allUsers}
      />}

      {currentMainView === 'calendar' && selectedBooking && (
        <Modal>
          <div
            className={`card-custom mx-4 min-h-[400px] flex flex-col ${
              user && user.isAdmin && !showConfirmDelete
                ? 'w-[500px] max-w-[95vw]'
                : 'w-[600px] max-w-[95vw]'
            }`}
          >
            <div className="flex-grow overflow-y-auto pb-4 pr-2">
              {!showConfirmDelete ? (
                <>
                  <h3 className="text-2xl font-bold mb-4 text-gray-800">Details zu: {selectedBooking.status === 'reserved' ? 'Reservierung' : 'Buchung'}</h3>
                  {user && user.isAdmin ? (
                    <>
                      <div className="mb-4">
                        <label htmlFor="editBookingUser" className="block text-sm font-medium text-gray-700 mb-1">Benutzer:</label>
                        <select id="editBookingUser" className="input-field" value={selectedBooking.userId.toString()} onChange={(e) => setSelectedBooking(prev => ({ ...prev, userId: parseInt(e.target.value), displayName: allUsers.find(u => u.id === parseInt(e.target.value))?.displayName || prev.displayName }))}>
                          {allUsers.map(u => <option key={u.id} value={u.id.toString()}>{u.displayName}</option>)}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label htmlFor="editBookingStartDate" className="block text-sm font-medium text-gray-700 mb-1">Startdatum:</label>
                        <input type="date" id="editBookingStartDate" className="input-field w-64" value={format(selectedBooking.start, 'yyyy-MM-dd')} onChange={(e) => setSelectedBooking(prev => ({ ...prev, start: new Date(e.target.value) }))} />
                      </div>
                      <div className="mb-4">
                        <label htmlFor="editBookingEndDate" className="block text-sm font-medium text-gray-700 mb-1">Enddatum:</label>
                        <input type="date" id="editBookingEndDate" className="input-field w-64" value={format(selectedBooking.end, 'yyyy-MM-dd')} onChange={(e) => setSelectedBooking(prev => ({ ...prev, end: new Date(e.target.value) }))} />
                      </div>
                      <div className="mb-4">
                        <label htmlFor="editBookingStatus" className="block text-sm font-medium text-gray-700 mb-1">Status:</label>
                        <select id="editBookingStatus" className="input-field" value={selectedBooking.status} onChange={(e) => setSelectedBooking(prev => ({ ...prev, status: e.target.value }))}>
                          <option value="booked">Gebucht</option>
                          <option value="reserved">Reserviert</option>
                          {/* Admin should be able to cancel too */}
                          <option value="cancelled">Storniert</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mb-2"><strong>Benutzer:</strong> {selectedBooking.displayName}</p>
                      <p className="mb-2"><strong>Status:</strong> <span className={`font-semibold ${
                        selectedBooking.status === 'reserved' ? 'text-yellow-600' :
                        selectedBooking.status === 'angefragt' ? 'text-amber-600' :
                        selectedBooking.status === 'cancelled' ? 'text-gray-500 line-through' :
                        'text-red-700'
                        }`}>
                        {selectedBooking.status === 'reserved' ? 'Reserviert' :
                         selectedBooking.status === 'angefragt' ? 'Angefragt' :
                         selectedBooking.status === 'cancelled' ? 'Storniert' :
                         'Gebucht'}
                        </span></p>
                      <p className="mb-2"><strong>Start:</strong> {format(selectedBooking.start, 'dd.MM.yyyy')}</p>
                      <p className="mb-4"><strong>Ende:</strong> {format(selectedBooking.end, 'dd.MM.yyyy')}</p>

                      {relevantNotificationForModal && selectedBooking.status === 'angefragt' && selectedBooking.userId !== user.id && (
                        <div className="my-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                          <p className="text-sm text-yellow-700">
                            Diese Buchung überschneidet sich mit Ihrer bestehenden Buchung.
                            <strong> {relevantNotificationForModal.message} </strong>
                          </p>
                          <div className="mt-3 flex space-x-2">
                            <button
                              onClick={() => handleRespondToOverlap(relevantNotificationForModal.id, 'approved')}
                              className="btn bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-1">
                              Überschneidung zustimmen
                            </button>
                            <button
                              onClick={() => handleRespondToOverlap(relevantNotificationForModal.id, 'rejected')}
                              className="btn bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1">
                              Überschneidung ablehnen
                            </button>
                          </div>
                        </div>
                      )}
                       {selectedBooking.status === 'angefragt' && selectedBooking.userId === user.id && (
                         <p className="text-sm text-amber-700 my-2 p-2 bg-amber-50 border border-amber-300 rounded-md">
                           Diese Anfrage wartet auf Bestätigung durch den primären Bucher.
                         </p>
                       )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold mb-4 text-gray-800">Löschen bestätigen</h3>
                  <p className="mb-6">Möchten Sie diese {selectedBooking.status === 'reserved' ? 'Reservierung' :
                                      selectedBooking.status === 'angefragt' ? 'Anfrage' :
                                      'Buchung'} wirklich unwiderruflich löschen?</p>
                </>
              )}
            </div>

            <div className="mt-auto pt-4">
              {!showConfirmDelete ? (
                <div className={`flex ${user && user.isAdmin ? 'justify-center' : 'justify-between items-center'} space-x-2`}>
                  {user && !user.isAdmin && selectedBooking.status !== 'angefragt' && selectedBooking.status !== 'cancelled' && (
                    <div>
                      {selectedBooking.status === 'reserved' && <button onClick={() => handleChangeBookingStatus(selectedBooking, 'booked')} className="btn bg-green-500 hover:bg-green-600 text-white">Zu Buchung ändern</button>}
                      {selectedBooking.status === 'booked' && <button onClick={() => handleChangeBookingStatus(selectedBooking, 'reserved')} className="btn bg-yellow-500 hover:bg-yellow-600 text-white">Zu Reservierung ändern</button>}
                    </div>
                  )}
                  <div className="flex space-x-2">
                    {user && user.isAdmin && selectedBooking.status !== 'cancelled' && <button onClick={() => handleUpdateBookingAdmin()} className="btn btn-primary">Änderungen speichern</button>}
                    {selectedBooking.status !== 'cancelled' && <button onClick={() => setShowConfirmDelete(true)} className="btn bg-red-600 hover:bg-red-700 text-white">Löschen</button>}
                    <button onClick={() => { setSelectedBooking(null); setRelevantNotificationForModal(null); }} className="btn btn-secondary">Schließen</button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end space-x-3">
                  <button onClick={handleDeleteBooking} className="btn bg-red-700 hover:bg-red-800 text-white">Ja, löschen</button>
                  <button onClick={() => setShowConfirmDelete(false)} className="btn btn-secondary">Nein, abbrechen</button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default App;
