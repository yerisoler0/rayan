# Proxy Reverso para Rayan VPS

Aplicación proxy simple para Render que oculta el servidor VPS real de la aplicación Rayan.

## 🚀 Despliegue en Render

### 1. Configurar variables de entorno (local)

Copia `.env.example` a `.env` y configura el dominio de tu VPS:

```bash
cp .env.example .env
# Edita .env y configura TARGET_URL
```

### 2. Subir a GitHub

**IMPORTANTE:** NO subas el archivo `.env` (ya está en `.gitignore`)

```bash
cd /srv/rayan/render-proxy
git init
git add .
git commit -m "Initial commit: Rayan VPS reverse proxy"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 3. Crear Web Service en Render

1. Ve a https://dashboard.render.com/
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio GitHub
4. Configuración:
   - **Name**: `rayan-proxy` (o `cambia-tu-vuelo`)
   - **Environment**: `Node`
   - **Region**: `Oregon` (o el más cercano)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### 4. Variables de entorno en Render

**MUY IMPORTANTE:** Agrega estas variables en la sección "Environment":

```
TARGET_URL=https://rayan.soldigroup.online
NODE_ENV=production
```

**Nota:** `TARGET_URL` debe ser el dominio de tu VPS, NO la IP directa.

### 5. Deploy

Click en "Create Web Service" y espera que se despliegue (2-3 minutos).

---

## 🔒 Configurar Firewall en VPS

### Obtener IPs de salida de Render

Ve a: https://render.com/docs/static-outbound-ip-addresses

IPs actuales de Render (verificar en la documentación):
```
44.194.88.0/24
44.195.248.0/24
3.211.0.0/16
(y otras más - consultar docs)
```

### Configurar UFW en VPS

```bash
# SSH a tu VPS
ssh root@168.231.69.125

# Permitir SOLO las IPs de Render al puerto 443
sudo ufw allow from 44.194.88.0/24 to any port 443
sudo ufw allow from 44.195.248.0/24 to any port 443
sudo ufw allow from 3.211.0.0/16 to any port 443

# Denegar acceso público directo
sudo ufw deny 443
sudo ufw deny 4321

# Habilitar firewall
sudo ufw enable

# Verificar reglas
sudo ufw status numbered
```

**Importante**: Asegúrate de agregar TODAS las IPs de Render de la documentación oficial.

---

## 🔄 Configurar UptimeRobot

Para mantener el servicio de Render despierto (plan gratuito):

1. Ve a https://uptimerobot.com/
2. Crea una cuenta gratuita
3. Agrega un nuevo monitor:
   - **Monitor Type**: HTTP(S)
   - **Friendly Name**: `Rayan Proxy`
   - **URL**: `https://cambia-tu-vuelo.onrender.com` (o tu URL de Render)
   - **Monitoring Interval**: `5 minutes`
4. Guarda

Esto hace ping cada 5 minutos y evita que Render suspenda el servicio.

---

## ✅ Verificación

### Probar el proxy:

```bash
# Debe responder (desde cualquier lugar)
curl -I https://cambia-tu-vuelo.onrender.com

# Debe devolver respuesta de la aplicación Rayan
curl https://cambia-tu-vuelo.onrender.com
```

### Verificar que VPS está protegido:

```bash
# Esto debe FALLAR (timeout o connection refused)
curl -I https://rayan.soldigroup.online

# Solo debe funcionar desde IPs de Render
```

---

## 🎯 Flujo completo

```
Usuario → https://cambia-tu-vuelo.onrender.com (Render)
              ↓
         [Proxy reenvía petición]
              ↓
         https://rayan.soldigroup.online (VPS - solo accesible desde Render)
              ↓
         Docker app:4321
              ↓
         Respuesta regresa a Render → Usuario
```

---

## 🔧 Mantenimiento

### Ver logs en Render:
1. Dashboard → Tu servicio → Logs
2. Buscar errores de proxy

### Actualizar código:
```bash
git add .
git commit -m "Update proxy"
git push
```
Render redesplegará automáticamente.

### Cambiar TARGET_URL:
1. Dashboard → Tu servicio → Environment
2. Editar `TARGET_URL`
3. Guardar (redespliega automáticamente)

---

## 🆘 Troubleshooting

### Error 502 Bad Gateway:
- Verificar que VPS está accesible desde IPs de Render
- Revisar firewall VPS
- Verificar que `TARGET_URL` es correcto

### Servicio se duerme:
- Verificar que UptimeRobot está configurado
- Plan gratuito: primer request tarda ~30s después de inactividad

### WebSocket no funciona:
- Verificar que `ws: true` está en `proxyOptions`
- Render soporta WebSockets nativamente

---

## 📝 Notas importantes

- **IP oculta**: Tu VPS solo es accesible desde IPs de Render
- **Dominio oculto**: Usuarios solo ven tu URL de Render
- **SSL gratis**: Render proporciona HTTPS automáticamente
- **Sin cambios**: Tu app Astro no necesita modificaciones
- **WebRTC y WebSocket**: Totalmente soportados

---

## 🔗 Actualizar PROXY_ALLOWED_DOMAIN

Una vez desplegado el proxy en Render, actualiza la variable de entorno en tu VPS:

```bash
# En /srv/rayan/.env
PROXY_ALLOWED_DOMAIN=cambia-tu-vuelo.onrender.com
```

Luego reinicia el contenedor:
```bash
cd /srv/rayan
docker-compose restart
```

---

## 📄 Licencia

Este proxy es código abierto para uso personal.
