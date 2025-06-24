const jwt = require('jsonwebtoken');

// Diese Middleware-Funktion schützt Routen.
// Sie prüft, ob ein gültiger JWT im 'Authorization'-Header mitgesendet wird.
const authMiddleware = (req, res, next) => {
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
    req.user = decoded;
    
    // Mit der Ausführung der eigentlichen Route fortfahren
    next();
  } catch (e) {
    res.status(400).json({ msg: 'Token ist nicht gültig.' });
  }
};

module.exports = authMiddleware;
