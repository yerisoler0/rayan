// Cargar variables de entorno desde .env
require('dotenv').config();

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// URL del servidor VPS (leer desde variable de entorno)
const TARGET_URL = process.env.TARGET_URL;

if (!TARGET_URL) {
  console.error('ERROR: TARGET_URL environment variable is required');
  process.exit(1);
}

// Configuración del proxy
const proxyOptions = {
  target: TARGET_URL,
  changeOrigin: true,  // Reescribe el header Host
  ws: true,            // Soporta WebSockets

  // Logging solo en desarrollo
  logLevel: process.env.NODE_ENV === 'production' ? 'silent' : 'info',

  // Reescribir headers que puedan exponer el servidor real
  onProxyRes: (proxyRes, req, res) => {
    // Remover headers que expongan el servidor original
    delete proxyRes.headers['x-powered-by'];

    // Reescribir header Location en redirects para evitar filtrar dominio real
    if (proxyRes.headers.location) {
      proxyRes.headers.location = proxyRes.headers.location
        .replace(/https?:\/\/rayan\.soldigroup\.online/gi, `https://${req.headers.host}`);
    }
  },

  // Manejo de errores
  onError: (err, req, res) => {
    console.error('Proxy error:', err.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'Unable to reach the service'
    });
  }
};

// Aplicar proxy a todas las rutas
app.use('/', createProxyMiddleware(proxyOptions));

// Iniciar servidor
const server = app.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`Forwarding requests to: ${TARGET_URL}`);
  } else {
    console.log('Proxy server started');
  }
});

// Manejo graceful de cierre
process.on('SIGTERM', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('SIGTERM received, closing server...');
  }
  server.close(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Server closed');
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('SIGINT received, closing server...');
  }
  server.close(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Server closed');
    }
    process.exit(0);
  });
});
