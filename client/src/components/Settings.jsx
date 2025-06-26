import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Import axios for API calls

const API_URL = `${import.meta.env.VITE_API_URL}/api`;

const Settings = ({ user, onUpdateUser }) => {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [pageTitle, setPageTitle] = useState(localStorage.getItem('pageTitle') || 'Belegungskalender');
  const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('primaryColor') || '#2563eb'); // Default blue-600
  const [secondaryColor, setSecondaryColor] = useState(localStorage.getItem('secondaryColor') || '#dc2626'); // Default red-600
  const [backgroundColor, setBackgroundColor] = useState(localStorage.getItem('backgroundColor') || '#f9fafb'); // Default gray-50
  const [publicHolidayColor, setPublicHolidayColor] = useState(localStorage.getItem('publicHolidayColor') || '#2563eb'); // Default blue-600
  const [schoolHolidayColor, setSchoolHolidayColor] = useState(localStorage.getItem('schoolHolidayColor') || '#a8a29e'); // Default stone-400
  const [bookedColor, setBookedColor] = useState(localStorage.getItem('bookedColor') || '#dc2626'); // Default red-600

  // Text color states
  const [primaryTextColor, setPrimaryTextColor] = useState(localStorage.getItem('primaryTextColor') || '#ffffff');
  const [secondaryTextColor, setSecondaryTextColor] = useState(localStorage.getItem('secondaryTextColor') || '#ffffff');
  const [backgroundColorText, setBackgroundColorText] = useState(localStorage.getItem('backgroundColorText') || '#111827'); // Default gray-900 for light backgrounds
  const [publicHolidayTextColor, setPublicHolidayTextColor] = useState(localStorage.getItem('publicHolidayTextColor') || '#ffffff');
  const [schoolHolidayTextColor, setSchoolHolidayTextColor] = useState(localStorage.getItem('schoolHolidayTextColor') || '#ffffff');
  const [bookedTextColor, setBookedTextColor] = useState(localStorage.getItem('bookedTextColor') || '#ffffff');
  // Assuming reservedTextColor will be derived or a fixed contrast color, e.g., dark gray or black, due to transparent background.
  // Or it could be the same as bookedTextColor if contrast is usually fine. For now, not a separate setting.

  useEffect(() => {
    // Apply the page title when the component mounts or pageTitle changes
    document.title = pageTitle;
    localStorage.setItem('pageTitle', pageTitle);
  }, [pageTitle]);

  useEffect(() => {
    // Apply colors when the component mounts or colors change
    // This is a basic example; more complex scenarios might involve CSS variables or context
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    localStorage.setItem('primaryColor', primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);
    localStorage.setItem('secondaryColor', secondaryColor);
  }, [secondaryColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--background-color', backgroundColor);
    localStorage.setItem('backgroundColor', backgroundColor);
    // Example: Apply background color to the body or a main container
    document.body.style.backgroundColor = backgroundColor;
  }, [backgroundColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--public-holiday-color', publicHolidayColor);
    localStorage.setItem('publicHolidayColor', publicHolidayColor);
  }, [publicHolidayColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--school-holiday-color', schoolHolidayColor);
    localStorage.setItem('schoolHolidayColor', schoolHolidayColor);
  }, [schoolHolidayColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--booked-color', bookedColor);
    localStorage.setItem('bookedColor', bookedColor);
  }, [bookedColor]);

  // useEffects for text colors
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-text-color', primaryTextColor);
    localStorage.setItem('primaryTextColor', primaryTextColor);
  }, [primaryTextColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--secondary-text-color', secondaryTextColor);
    localStorage.setItem('secondaryTextColor', secondaryTextColor);
  }, [secondaryTextColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--background-text-color', backgroundColorText);
    localStorage.setItem('backgroundColorText', backgroundColorText);
    // Apply to body text color for global effect if desired
    // document.body.style.color = backgroundColorText;
  }, [backgroundColorText]);

  useEffect(() => {
    document.documentElement.style.setProperty('--public-holiday-text-color', publicHolidayTextColor);
    localStorage.setItem('publicHolidayTextColor', publicHolidayTextColor);
  }, [publicHolidayTextColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--school-holiday-text-color', schoolHolidayTextColor);
    localStorage.setItem('schoolHolidayTextColor', schoolHolidayTextColor);
  }, [schoolHolidayTextColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--booked-text-color', bookedTextColor);
    localStorage.setItem('bookedTextColor', bookedTextColor);
  }, [bookedTextColor]);


  const handleSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    // Update displayName through API if user is logged in
    if (user && onUpdateUser && token) {
      try {
        // API call to update displayName
        const response = await axios.put(
          `${API_URL}/users/profile`,
          { displayName },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Update user state in App.jsx with the response from the server
        onUpdateUser(response.data);

        // For other settings, continue using localStorage
        localStorage.setItem('pageTitle', pageTitle);
        localStorage.setItem('primaryColor', primaryColor);
        localStorage.setItem('secondaryColor', secondaryColor);
        localStorage.setItem('backgroundColor', backgroundColor);
        localStorage.setItem('publicHolidayColor', publicHolidayColor);
        localStorage.setItem('schoolHolidayColor', schoolHolidayColor);
        localStorage.setItem('bookedColor', bookedColor);
        // Save text colors
        localStorage.setItem('primaryTextColor', primaryTextColor);
        localStorage.setItem('secondaryTextColor', secondaryTextColor);
        localStorage.setItem('backgroundColorText', backgroundColorText);
        localStorage.setItem('publicHolidayTextColor', publicHolidayTextColor);
        localStorage.setItem('schoolHolidayTextColor', schoolHolidayTextColor);
        localStorage.setItem('bookedTextColor', bookedTextColor);


        alert('Einstellungen gespeichert!');
      } catch (error) {
        console.error("Fehler beim Speichern der Einstellungen:", error);
        alert('Fehler beim Speichern des Anzeigenamens.');
      }
    } else {
      // Handle settings for non-logged-in users or if onUpdateUser is not provided
      localStorage.setItem('pageTitle', pageTitle);
      localStorage.setItem('primaryColor', primaryColor);
      localStorage.setItem('secondaryColor', secondaryColor);
      localStorage.setItem('backgroundColor', backgroundColor);
      localStorage.setItem('publicHolidayColor', publicHolidayColor);
      localStorage.setItem('schoolHolidayColor', schoolHolidayColor);
      localStorage.setItem('bookedColor', bookedColor);
      // Save text colors
      localStorage.setItem('primaryTextColor', primaryTextColor);
      localStorage.setItem('secondaryTextColor', secondaryTextColor);
      localStorage.setItem('backgroundColorText', backgroundColorText);
      localStorage.setItem('publicHolidayTextColor', publicHolidayTextColor);
      localStorage.setItem('schoolHolidayTextColor', schoolHolidayTextColor);
      localStorage.setItem('bookedTextColor', bookedTextColor);
      alert('Einstellungen gespeichert! (Lokale Einstellungen aktualisiert)');
    }
  };

  // Helper for preview box
  const ColorPreview = ({ bgColor, textColor, label }) => (
    <div style={{ backgroundColor: bgColor, color: textColor }} className="p-2 rounded text-center text-sm h-16 flex items-center justify-center">
      {label}
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-full"> {/* Changed main bg for contrast */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-gray-800" style={{color: 'var(--primary-color)'}}>Einstellungen</h2>

        <form onSubmit={handleSave} className="space-y-8">

          {/* Allgemeine Einstellungen Card */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Allgemein</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">Anzeigename</label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  disabled={!user}
                />
              </div>
              <div>
                <label htmlFor="pageTitle" className="block text-sm font-medium text-gray-700 mb-1">Seitentitel</label>
                <input
                  type="text"
                  id="pageTitle"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Theme Farben Card */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-2">Theme-Farben</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">

              {/* Primary Color Setting */}
              <div className="space-y-2">
                <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700">Primärfarbe</label>
                <input type="color" id="primaryColor" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <label htmlFor="primaryTextColor" className="block text-sm font-medium text-gray-700 mt-2">Textfarbe für Primär</label>
                <input type="color" id="primaryTextColor" value={primaryTextColor} onChange={(e) => setPrimaryTextColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <ColorPreview bgColor={primaryColor} textColor={primaryTextColor} label="Beispiel Text" />
              </div>

              {/* Secondary Color Setting */}
              <div className="space-y-2">
                <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700">Sekundärfarbe</label>
                <input type="color" id="secondaryColor" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <label htmlFor="secondaryTextColor" className="block text-sm font-medium text-gray-700 mt-2">Textfarbe für Sekundär</label>
                <input type="color" id="secondaryTextColor" value={secondaryTextColor} onChange={(e) => setSecondaryTextColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <ColorPreview bgColor={secondaryColor} textColor={secondaryTextColor} label="Beispiel Text" />
              </div>

              {/* Background Color Setting */}
              <div className="space-y-2">
                <label htmlFor="backgroundColor" className="block text-sm font-medium text-gray-700">App Hintergrund</label>
                <input type="color" id="backgroundColor" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <label htmlFor="backgroundColorText" className="block text-sm font-medium text-gray-700 mt-2">Textfarbe für App Hintergrund</label>
                <input type="color" id="backgroundColorText" value={backgroundColorText} onChange={(e) => setBackgroundColorText(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <ColorPreview bgColor={backgroundColor} textColor={backgroundColorText} label="Beispiel Text" />
              </div>
            </div>
          </div>

          {/* Kalenderfarben Card */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-2">Kalenderfarben</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">

              {/* Booked Color Setting */}
              <div className="space-y-2">
                <label htmlFor="bookedColor" className="block text-sm font-medium text-gray-700">Gebuchte Termine</label>
                <input type="color" id="bookedColor" value={bookedColor} onChange={(e) => setBookedColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <label htmlFor="bookedTextColor" className="block text-sm font-medium text-gray-700 mt-2">Textfarbe für Gebucht</label>
                <input type="color" id="bookedTextColor" value={bookedTextColor} onChange={(e) => setBookedTextColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <ColorPreview bgColor={bookedColor} textColor={bookedTextColor} label="Gebucht" />
              </div>

              {/* Public Holiday Color Setting */}
              <div className="space-y-2">
                <label htmlFor="publicHolidayColor" className="block text-sm font-medium text-gray-700">Feiertage</label>
                <input type="color" id="publicHolidayColor" value={publicHolidayColor} onChange={(e) => setPublicHolidayColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <label htmlFor="publicHolidayTextColor" className="block text-sm font-medium text-gray-700 mt-2">Textfarbe für Feiertage</label>
                <input type="color" id="publicHolidayTextColor" value={publicHolidayTextColor} onChange={(e) => setPublicHolidayTextColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <ColorPreview bgColor={publicHolidayColor} textColor={publicHolidayTextColor} label="Feiertag" />
              </div>

              {/* School Holiday Color Setting */}
              <div className="space-y-2">
                <label htmlFor="schoolHolidayColor" className="block text-sm font-medium text-gray-700">Schulferien</label>
                <input type="color" id="schoolHolidayColor" value={schoolHolidayColor} onChange={(e) => setSchoolHolidayColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <label htmlFor="schoolHolidayTextColor" className="block text-sm font-medium text-gray-700 mt-2">Textfarbe für Schulferien</label>
                <input type="color" id="schoolHolidayTextColor" value={schoolHolidayTextColor} onChange={(e) => setSchoolHolidayTextColor(e.target.value)} className="w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"/>
                <ColorPreview bgColor={schoolHolidayColor} textColor={schoolHolidayTextColor} label="Ferien" />
              </div>
            </div>
            <div className="mt-6 text-sm text-gray-600">
              <p>Hinweis: Reservierte Termine verwenden die Hintergrundfarbe von "Gebuchte Termine" mit 40% Transparenz. Die Textfarbe für reservierte Termine wird aktuell von "Textfarbe für Gebucht" übernommen, kann aber je nach Kontrast angepasst werden müssen (ggf. in zukünftigen Versionen separate Einstellung).</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              className="px-8 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: 'var(--primary-color)', color: 'var(--primary-text-color)' }}
            >
              Einstellungen Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
