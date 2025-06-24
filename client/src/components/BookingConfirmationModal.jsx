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
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)', minWidth: '300px', maxWidth: '500px'
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
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    onSubmit(parsedStartDate, parsedEndDate, type);
  };

  return (
    <ModalDialog onClose={onClose}>
      <h2 className="text-xl font-semibold mb-4">Buchung bestätigen oder reservieren</h2>
      <div className="mb-4">
        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
          Startdatum:
        </label>
        <input
          type="date"
          id="startDate"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div className="mb-6">
        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
          Enddatum:
        </label>
        <input
          type="date"
          id="endDate"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div className="flex justify-end space-x-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none"
        >
          Abbrechen
        </button>
        <button
          onClick={() => handleSubmit('reserved')}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          Reservieren
        </button>
        <button
          onClick={() => handleSubmit('booked')}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Buchen
        </button>
      </div>
    </ModalDialog>
  );
};

export default BookingConfirmationModal;
