import { useState } from 'react';
import axios from 'axios';

// Die Login-Komponente erhält zwei Funktionen als Props:
// onLoginSuccess: Wird nach erfolgreichem Login aufgerufen.
// setView: Ändert die Ansicht, z.B. um zum Registrierungsformular zu wechseln.
function Login({ onLoginSuccess, setView }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Die Basis-URL wird aus der .env-Datei gelesen
  const API_URL = `${import.meta.env.VITE_API_URL}/api`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Fehler zurücksetzen

    if (!email || !password) {
      setError('Bitte füllen Sie alle Felder aus.');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      // Bei Erfolg wird die onLoginSuccess-Funktion aus App.jsx aufgerufen
      // und der Token sowie die Benutzerdaten übergeben.
      onLoginSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.msg || 'Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.');
    }
  };

  return (
    <div className="flex justify-center items-center mt-10">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800">Anmelden</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              E-Mail
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-700"
            >
              Passwort
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Anmelden
            </button>
          </div>
        </form>
        <p className="text-sm text-center text-gray-600">
          Noch kein Konto?{' '}
          <button onClick={() => setView('register')} className="font-medium text-blue-600 hover:underline">
            Registrieren
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
