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
      <div className="card-custom w-full max-w-md p-8 space-y-6"> {/* Use card-custom for consistent card styling */}
        <h2 className="text-3xl font-bold text-center text-gray-800">Anmelden</h2> {/* Larger heading */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>} {/* Enhanced error message style */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1"> {/* Added margin-bottom to label */}
              E-Mail
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field" // Use global input-field style
              required
              placeholder="ihre.email@example.com" // Added placeholder
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1" // Added margin-bottom to label
            >
              Passwort
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field" // Use global input-field style
              required
              placeholder="********" // Added placeholder
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full btn btn-primary" // Use global button styles
            >
              Anmelden
            </button>
          </div>
        </form>
        <p className="text-sm text-center text-gray-600">
          Noch kein Konto?{' '}
          <button
            onClick={() => setView('register')}
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline" // Enhanced link style
          >
            Registrieren
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
