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

// Extraer el dominio real de TARGET_URL para reemplazarlo
const targetDomain = TARGET_URL.replace(/https?:\/\//, '').replace(/\/$/, '');
const targetIP = '168.231.69.125'; // IP de la VPS a ocultar

// Configuración del proxy
const proxyOptions = {
  target: TARGET_URL,
  changeOrigin: true,  // Reescribe el header Host
  ws: true,            // Soporta WebSockets
  followRedirects: true,
  secure: true,

  // Logging solo en desarrollo
  logLevel: process.env.NODE_ENV === 'production' ? 'silent' : 'info',

  // Modificar request antes de enviarlo al servidor real
  onProxyReq: (proxyReq, req, res) => {
    // Eliminar headers que puedan exponer información
    proxyReq.removeHeader('x-forwarded-host');
    proxyReq.removeHeader('x-forwarded-server');

    // Asegurar que el referer no exponga el proxy
    if (req.headers.referer) {
      const newReferer = req.headers.referer.replace(
        new RegExp(req.headers.host, 'gi'),
        targetDomain
      );
      proxyReq.setHeader('referer', newReferer);
    }
  },

  // Reescribir headers que puedan exponer el servidor real
  onProxyRes: (proxyRes, req, res) => {
    // Remover headers que expongan el servidor original
    delete proxyRes.headers['x-powered-by'];
    delete proxyRes.headers['server'];
    delete proxyRes.headers['x-aspnet-version'];
    delete proxyRes.headers['x-aspnetmvc-version'];

    // Reescribir header Location en redirects para evitar filtrar dominio real
    if (proxyRes.headers.location) {
      proxyRes.headers.location = proxyRes.headers.location
        .replace(new RegExp(`https?://${targetDomain}`, 'gi'), `https://${req.headers.host}`)
        .replace(new RegExp(targetIP, 'g'), req.headers.host);
    }

    // Reescribir cookies para que usen el dominio del proxy
    if (proxyRes.headers['set-cookie']) {
      proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
        return cookie
          .replace(new RegExp(`domain=${targetDomain}`, 'gi'), `domain=${req.headers.host}`)
          .replace(new RegExp(targetDomain, 'gi'), req.headers.host)
          .replace(new RegExp(targetIP, 'g'), req.headers.host);
      });
    }

    // Reescribir contenido HTML/JS que pueda contener el dominio real
    const contentType = proxyRes.headers['content-type'] || '';
    if (contentType.includes('text/html') ||
        contentType.includes('application/javascript') ||
        contentType.includes('text/javascript') ||
        contentType.includes('application/json')) {

      delete proxyRes.headers['content-length'];

      let body = '';
      proxyRes.on('data', (chunk) => {
        body += chunk.toString('utf8');
      });

      proxyRes.on('end', () => {
        // Reemplazar todas las referencias al dominio real y la IP
        body = body
          .replace(new RegExp(`https?://${targetDomain}`, 'gi'), `https://${req.headers.host}`)
          .replace(new RegExp(targetDomain, 'gi'), req.headers.host)
          .replace(new RegExp(targetIP, 'g'), req.headers.host);

        res.end(body);
      });

      // No enviar la respuesta automáticamente
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
    }
  },

  // Manejo de errores (sin exponer información sensible)
  onError: (err, req, res) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Proxy error:', err.message);
    }

    // No exponer detalles del error en producción
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Service Temporarily Unavailable',
        message: 'Please try again later'
      });
    }
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
