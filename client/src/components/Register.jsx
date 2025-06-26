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
      <div className="card-custom w-full max-w-md p-8 space-y-6"> {/* Use card-custom for consistent card styling */}
        <h2 className="text-3xl font-bold text-center text-gray-800">Registrieren</h2> {/* Larger heading */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-red-600 text-sm text-center font-medium">{error}</p>} {/* Enhanced error message style */}
          {success && <p className="text-green-600 text-sm text-center font-medium">{success}</p>} {/* Enhanced success message style */}
          <div>
            <label htmlFor="displayName-reg" className="block text-sm font-medium text-gray-700 mb-1"> {/* Added margin-bottom to label */}
              Anzeigename
            </label>
            <input
              type="text"
              id="displayName-reg"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field" // Use global input-field style
              required
              placeholder="Ihr Anzeigename" // Added placeholder
            />
          </div>
          <div>
            <label htmlFor="email-reg" className="block text-sm font-medium text-gray-700 mb-1"> {/* Added margin-bottom to label */}
              E-Mail
            </label>
            <input
              type="email"
              id="email-reg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field" // Use global input-field style
              required
              placeholder="ihre.email@example.com" // Added placeholder
            />
          </div>
          <div>
            <label
              htmlFor="password-reg"
              className="block text-sm font-medium text-gray-700 mb-1" // Added margin-bottom to label
            >
              Passwort
            </label>
            <input
              type="password"
              id="password-reg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field" // Use global input-field style
              required
              placeholder="Mindestens 6 Zeichen" // Added placeholder
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-700 mb-1" // Added margin-bottom to label
            >
              Passwort bestätigen
            </label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field" // Use global input-field style
              required
              placeholder="Passwort erneut eingeben" // Added placeholder
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full btn btn-primary" // Use global button styles
            >
              Konto erstellen
            </button>
          </div>
        </form>
        <p className="text-sm text-center text-gray-600">
          Bereits ein Konto?{' '}
          <button
            onClick={() => setView('login')}
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline" // Enhanced link style
          >
            Anmelden
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;
