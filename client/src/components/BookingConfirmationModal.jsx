// client/src/components/BookingConfirmationModal.jsx
import React, { useState, useEffect } from 'react';
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';

const ModalDialog = ({ children, onClose }) => (
  <div
    style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1050
    }}
    onClick={onClose} // Close on backdrop click
  >
    <div
      style={{
        backgroundColor: 'white', padding: '20px', borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        minWidth: '300px', maxWidth: '960px', // Aggressively increased maxWidth
        minHeight: '400px', // Added minHeight
        overflowY: 'auto' // Ensure scrolling if content overflows vertically
      }}
      onClick={e => e.stopPropagation()} // Prevent modal close when clicking inside modal content
    >
      {children}
    </div>
  </div>
);

const BookingConfirmationModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialStartDate,
  initialEndDate,
  currentUser, // Added: current user, contains isAdmin
  allUsers,    // Added: list of all users for admin
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // New state for admin to select a user
  const [selectedUserId, setSelectedUserId] = useState(currentUser ? currentUser.id.toString() : '');


  useEffect(() => {
    // When current user changes (e.g., on initial load or re-login), reset selectedUserId
    if (currentUser) {
      setSelectedUserId(currentUser.id.toString());
    }
  }, [currentUser]);

  useEffect(() => {
    if (initialStartDate) {
      setStartDate(format(initialStartDate, 'yyyy-MM-dd'));
    }
    if (initialEndDate) {
      setEndDate(format(initialEndDate, 'yyyy-MM-dd'));
    }
  }, [initialStartDate, initialEndDate]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (type) => {
    // Validate dates
    if (!startDate || !endDate) {
      alert('Bitte Start- und Enddatum auswählen.');
      return;
    }
    const parsedStartDate = parseISO(startDate);
    const parsedEndDate = parseISO(endDate);

    if (parsedEndDate < parsedStartDate) {
      alert('Das Enddatum darf nicht vor dem Startdatum liegen.');
      return;
    }
    // Pass selectedUserId to the onSubmit handler
    onSubmit(parsedStartDate, parsedEndDate, type, selectedUserId);
  };

  return (
    <ModalDialog onClose={onClose}>
      <div className="p-4 w-full"> {/* Increased padding and ensured w-full */}
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Buchung bestätigen oder reservieren</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Startdatum:
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field w-64" // Specific width
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              Enddatum:
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field w-64" // Specific width
            />
          </div>
          {currentUser && currentUser.isAdmin && allUsers && allUsers.length > 0 && (
            <div>
              <label htmlFor="userSelect" className="block text-sm font-medium text-gray-700 mb-1">
                Benutzer auswählen (Admin):
              </label>
              <select
                id="userSelect"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="input-field" // Use global input-field style
              >
                {allUsers.map(user => (
                  <option key={user.id} value={user.id.toString()}>
                    {user.displayName} (ID: {user.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-3 mt-8"> {/* Increased top margin for button group */}
          <button
            onClick={onClose}
            className="btn btn-secondary" // Use global button styles
          >
            Abbrechen
          </button>
          <button
            onClick={() => handleSubmit('reserved')}
            className="btn bg-yellow-500 hover:bg-yellow-600 text-white" // Specific style for reservieren
          >
            Reservieren
          </button>
          <button
            onClick={() => handleSubmit('booked')}
            className="btn btn-primary" // Use global button styles for main action
          >
            Buchen
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};

export default BookingConfirmationModal;
