const jwt = require('jsonwebtoken');

// Diese Middleware-Funktion schützt Routen.
// Sie prüft, ob ein gültiger JWT im 'Authorization'-Header mitgesendet wird.
const authMiddleware = async (req, res, next) => { // Made function async
  // Token aus dem Header extrahieren (Format: "Bearer TOKEN")
  const authHeader = req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'Kein Token, Autorisierung verweigert.' });
  }

  try {
    const token = authHeader.split(' ')[1];

    // Token verifizieren
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Die entschlüsselten Benutzerdaten an das Request-Objekt anhängen
    // Wichtig: Wir müssen den Benutzer aus der DB laden, um aktuelle isAdmin Info zu haben
    const User = require('../models/User'); // User-Modell importieren
    const userFromDb = await User.findByPk(decoded.id);

    if (!userFromDb) {
      return res.status(401).json({ msg: 'Benutzer nicht gefunden.' });
    }

    req.user = {
      id: userFromDb.id,
      email: userFromDb.email,
      displayName: userFromDb.displayName,
      isAdmin: userFromDb.isAdmin, // isAdmin Status hinzufügen
    };
    
    // Mit der Ausführung der eigentlichen Route fortfahren
    next();
  } catch (e) {
    res.status(400).json({ msg: 'Token ist nicht gültig.' });
  }
};

// Middleware um Admin-Routen zu schützen
const adminOnly = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ msg: 'Zugriff verweigert. Nur für Administratoren.' });
  }
};

module.exports = { authMiddleware, adminOnly };
