import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Import axios for API calls

const API_URL = `${import.meta.env.VITE_API_URL}/api`;

const Settings = ({ user, onUpdateUser }) => {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [pageTitle, setPageTitle] = useState(localStorage.getItem('pageTitle') || 'Belegungskalender');
  const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('primaryColor') || '#2563eb'); // Default blue-600
  const [secondaryColor, setSecondaryColor] = useState(localStorage.getItem('secondaryColor') || '#dc2626'); // Default red-600
  const [backgroundColor, setBackgroundColor] = useState(localStorage.getItem('backgroundColor') || '#f9fafb'); // Default gray-50

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
      alert('Einstellungen gespeichert! (Lokale Einstellungen aktualisiert)');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Einstellungen</h2>
      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Anzeigename</label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={!user} // Disable if no user is logged in
          />
        </div>

        <div>
          <label htmlFor="pageTitle" className="block text-sm font-medium text-gray-700">Seitentitel</label>
          <input
            type="text"
            id="pageTitle"
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700">Primärfarbe</label>
            <input
              type="color"
              id="primaryColor"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="mt-1 block w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"
            />
          </div>

          <div>
            <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700">Sekundärfarbe</label>
            <input
              type="color"
              id="secondaryColor"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="mt-1 block w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"
            />
          </div>

          <div>
            <label htmlFor="backgroundColor" className="block text-sm font-medium text-gray-700">Hintergrundfarbe</label>
            <input
              type="color"
              id="backgroundColor"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="mt-1 block w-full h-10 border border-gray-300 rounded-md shadow-sm cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            style={{ backgroundColor: 'var(--primary-color)' }} // Use CSS variable for button color
          >
            Speichern
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
