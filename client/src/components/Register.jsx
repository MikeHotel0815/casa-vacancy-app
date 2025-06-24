import { useState } from 'react';
import axios from 'axios';

// Die Register-Komponente erhält eine Funktion als Prop, 
// um die Ansicht wieder auf 'login' zu setzen.
function Register({ setView }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = `${import.meta.env.VITE_API_URL}/api`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        displayName,
        email,
        password,
      });
      setSuccess(response.data.msg + ' Sie können sich jetzt anmelden.');
      // Optional: Nach erfolgreicher Registrierung automatisch zum Login wechseln
      // setTimeout(() => setView('login'), 2000); 
    } catch (err) {
      setError(err.response?.data?.msg || 'Registrierung fehlgeschlagen.');
    }
  };

  return (
    <div className="flex justify-center items-center mt-10">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800">Registrieren</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          {success && <p className="text-green-500 text-sm text-center">{success}</p>}
          <div>
            <label htmlFor="displayName-reg" className="text-sm font-medium text-gray-700">
              Anzeigename
            </label>
            <input
              type="text"
              id="displayName-reg"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="email-reg" className="text-sm font-medium text-gray-700">
              E-Mail
            </label>
            <input
              type="email"
              id="email-reg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password-reg"
              className="text-sm font-medium text-gray-700"
            >
              Passwort
            </label>
            <input
              type="password"
              id="password-reg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="text-sm font-medium text-gray-700"
            >
              Passwort bestätigen
            </label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Konto erstellen
            </button>
          </div>
        </form>
        <p className="text-sm text-center text-gray-600">
          Bereits ein Konto?{' '}
          <button onClick={() => setView('login')} className="font-medium text-blue-600 hover:underline">
            Anmelden
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;
