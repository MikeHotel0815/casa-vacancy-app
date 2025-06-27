import React from 'react';
import { createPortal } from 'react-dom';
import format from 'date-fns/format';

// Die generische Modal-Komponente (ähnlich der in App.jsx)
// Es ist oft besser, eine solche generische Komponente in eine eigene Datei auszulagern,
// aber für dieses Beispiel nehmen wir an, sie ist hier für NotificationsModal spezifisch angepasst
// oder wir kopieren die Logik aus App.jsx.
// Für eine saubere Struktur wäre eine allgemeine Modal-Komponente unter `client/src/components/shared/Modal.jsx` ideal.

const GenericModal = ({ children, onClose }) => {
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
    zIndex: 1050, // Höherer z-index als andere Modals falls nötig
  };

  const modalContentStyle = {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    // Breite und Höhe werden durch Tailwind-Klassen auf dem Kind-Element gesteuert
  };

  // Verhindert, dass Klicks im Modal das Modal schließen, nur Klicks auf den Hintergrund
  const handleContentClick = (e) => e.stopPropagation();

  return createPortal(
    <div style={modalWrapperStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={handleContentClick}>
        {children}
      </div>
    </div>,
    document.body
  );
};


const NotificationsModal = ({
  isOpen,
  onClose,
  notifications,
  onDeleteNotification,
  onMarkAsRead,
  onRespondToOverlap // Hinzugefügt für Konsistenz mit altem Dropdown
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <GenericModal onClose={onClose}>
      <div className="card-custom p-0 w-[640px] max-h-[70vh] flex flex-col"> {/* Styling für Größe und Karte */}
        <header className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Benachrichtigungen</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
            aria-label="Schließen"
          >
            &times;
          </button>
        </header>

        <div className="p-4 flex-grow overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">Keine neuen Benachrichtigungen.</p>
          ) : (
            <ul>
              {notifications.map(notification => (
                <li
                  key={notification.id}
                  className={`p-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 ${!notification.isRead ? 'font-semibold bg-blue-50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div
                      className="flex-grow cursor-pointer pr-2" // pr-2 für etwas Abstand zum X
                      onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
                    >
                      <p className="text-sm text-gray-700 mb-1">{notification.message}</p>
                      <p className="text-xs text-gray-500">{format(new Date(notification.createdAt), 'dd.MM.yyyy HH:mm')}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteNotification(notification.id); }}
                      className="ml-2 text-red-500 hover:text-red-700 font-bold text-lg leading-none p-1 flex-shrink-0"
                      aria-label="Benachrichtigung löschen"
                    >
                      &times;
                    </button>
                  </div>
                  {/* Logik für 'overlap_request' Buttons, falls vorhanden */}
                  {notification.type === 'overlap_request' && notification.response === 'pending' && (
                    <div className="mt-2 flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRespondToOverlap(notification.id, 'approved');
                          // onClose(); // Modal nach Aktion schließen? Optional.
                        }}
                        className="btn bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1"
                      >
                        Zustimmen
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRespondToOverlap(notification.id, 'rejected');
                          // onClose(); // Modal nach Aktion schließen? Optional.
                        }}
                        className="btn bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1"
                      >
                        Ablehnen
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Schließen
          </button>
        </footer>
      </div>
    </GenericModal>
  );
};

export default NotificationsModal;
