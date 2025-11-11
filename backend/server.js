const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware para Twilio (x-www-form-urlencoded) y JSON
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

// --------- DB ----------
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS evidencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT,
      destino TEXT,
      oc_pedido TEXT,
      equipo TEXT,
      operador TEXT,
      permisionario TEXT,
      status_entrega TEXT,
      hr_entrega TEXT,
      observaciones TEXT,
      evidencia_status TEXT DEFAULT 'PENDIENTE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// --------- Permisionarios ----------
const permisionariosMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'permisionarios.json'), 'utf8')
);

function getPermisionario(operador) {
  return permisionariosMap[operador] || 'DESCONOCIDO';
}

// --------- Parser del mensaje de WhatsApp ----------
function parseMensajeEntrega(texto) {
  // Quitamos posible encabezado tipo [12:35 p.m., 9/11/2025] Transportes Vepo:
  const sinHeader = texto.replace(/^\[[^\]]+\]\s*[^:]+:\s*/m, '');

  const lineas = sinHeader.split('\n').map(l => l.trim());
  const datos = {};

  for (const linea of lineas) {
    if (linea.startsWith('CLIENTE:')) {
      datos.cliente = linea.split('CLIENTE:')[1].trim();
    } else if (linea.startsWith('DESTINO:')) {
      datos.destino = linea.split('DESTINO:')[1].trim();
    } else if (linea.startsWith('OC_PEDIDO:')) {
      datos.oc_pedido = linea.split('OC_PEDIDO:')[1].trim();
    } else if (linea.startsWith('EQUIPO:')) {
      datos.equipo = linea.split('EQUIPO:')[1].trim();
    } else if (linea.startsWith('OPERADOR:')) {
      datos.operador = linea.split('OPERADOR:')[1].trim();
    } else if (linea.startsWith('STATUS:')) {
      datos.status_entrega = linea.split('STATUS:')[1].trim();
    } else if (linea.startsWith('HR ENTREGA:')) {
      datos.hr_entrega = linea.split('HR ENTREGA:')[1].trim();
    } else if (linea.startsWith('OBSERVACIONES:')) {
      datos.observaciones = linea.split('OBSERVACIONES:')[1].trim();
    }
  }

  return datos;
}

// --------- Webhook para Twilio ----------
app.post('/whatsapp', (req, res) => {
  const body = req.body.Body || '';

  // Solo procesamos si viene un STATUS: ENTREGADO
  if (!body.includes('STATUS: ENTREGADO')) {
    res.set('Content-Type', 'text/xml');
    return res.send('<Response></Response>');
  }

  const datos = parseMensajeEntrega(body);
  const permisionario = getPermisionario(datos.operador);

  const stmt = db.prepare(`
    INSERT INTO evidencias (
      cliente, destino, oc_pedido, equipo, operador,
      permisionario, status_entrega, hr_entrega, observaciones,
      evidencia_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    datos.cliente,
    datos.destino,
    datos.oc_pedido,
    datos.equipo,
    datos.operador,
    permisionario,
    datos.status_entrega,
    datos.hr_entrega,
    datos.observaciones,
    'PENDIENTE',
    function (err) {
      if (err) {
        console.error('Error insertando evidencia:', err);
      }
      stmt.finalize();

      // Respuesta vacía para Twilio
      res.set('Content-Type', 'text/xml');
      res.send('<Response></Response>');
    }
  );
});

// --------- API: listar órdenes ----------
app.get('/api/ordenes', (req, res) => {
  const status = req.query.status; // PENDIENTE, RECOLECTADO, ENTREGADO
  const hoy = new Date();

  let query = 'SELECT * FROM evidencias';
  const params = [];

  if (status) {
    query += ' WHERE evidencia_status = ?';
    params.push(status);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error consultando evidencias:', err);
      return res.status(500).json({ error: 'Error consultando evidencias' });
    }

    const conAlerta = rows.map(row => {
      const createdAt = new Date(row.created_at);
      const diffMs = hoy - createdAt;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const requiere_alerta =
        row.evidencia_status === 'PENDIENTE' && diffDias >= 3;

      return {
        ...row,
        dias_desde_creacion: diffDias,
        requiere_alerta
      };
    });

    res.json(conAlerta);
  });
});

// --------- API: actualizar estatus de evidencia ----------
app.patch('/api/ordenes/:id', (req, res) => {
  const id = req.params.id;
  const nuevoStatus = req.body.evidencia_status;

  if (!['PENDIENTE', 'RECOLECTADO', 'ENTREGADO'].includes(nuevoStatus)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const stmt = db.prepare(`
    UPDATE evidencias
    SET evidencia_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(nuevoStatus, id, function (err) {
    if (err) {
      console.error('Error actualizando evidencia:', err);
      return res.status(500).json({ error: 'Error actualizando evidencia' });
    }
    res.json({ ok: true });
  });
});

// --------- Arranque ----------
app.listen(PORT, () => {
  console.log(`Backend escuchando en puerto ${PORT}`);
});
