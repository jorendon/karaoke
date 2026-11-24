# Instalar Karaoke en Casa en TV Samsung (Tizen)

Tienes **dos opciones** para usar `https://karaoke.jrendon.dev` en tu TV Samsung:

---

## Opción 1 — Navegador de la TV Samsung + Control desde tu celular (Recomendada, 2 minutos)

No requiere instalar software en tu PC:

1. En tu TV Samsung abre la app **Internet** (el navegador integrado).
2. Entra a **`https://karaoke.jrendon.dev`**.
3. Inicia sesión dejando marcada la casilla **"Mantener sesión iniciada 30 días (ideal para TV)"**.
4. Guárdala en **Favoritos / Marcadores** del navegador Samsung.
5. Abre tu sesión en **Pantalla TV** (`/host/[codigo]`).
6. **Maneja todo desde tu celular:** entra a **`https://karaoke.jrendon.dev`** en tu celular, inicia sesión y pulsa el botón **Control** (`/remote/[codigo]`) en tu sesión activa. Desde tu celular podrás:
   - Pausar / Reanudar el video en la TV
   - Pasar a la **Siguiente** canción
   - Recoger o mostrar los paneles de **Cola** y **QR** o **Ampliar TV**
   - Subir, bajar, reproducir ya o eliminar canciones
   - Buscar y agregar canciones

---

## Opción 2 — App con ícono propio en el menú de Samsung TV (Tizen Studio)

La carpeta `tizen/` ya incluye el paquete listo (`config.xml`, `index.html` e `icon.png`).

### Paso 1: Activar Modo Desarrollador en tu TV Samsung
1. Enciende tu TV Samsung y entra a la sección **Apps**.
2. Con el control remoto, presiona **`1` `2` `3` `4` `5`** en secuencia.
3. En la ventana **Developer Mode**:
   - Activa **Developer mode: On**.
   - En **Host PC IP**, escribe la IP local de tu computadora (ej. `192.168.1.50`).
   - Pulsa **OK** y **reinicia la TV** (mantén presionado el botón de encendido hasta que reinicie).

### Paso 2: Instalar desde tu PC con Tizen Studio
1. Instala **Tizen Studio** (con **TV Extensions** desde Package Manager) en Windows o Mac.
2. En Tizen Studio abre **Tools → Certificate Manager** y crea un certificado **Samsung** (iniciando sesión con tu cuenta Samsung gratuita).
3. Abre **Tools → Device Manager** → botón **Remote Device Manager** → agrega la IP de tu TV Samsung y conéctala.
4. Importa esta carpeta `tizen/` (**File → Open Projects from File System...** → selecciona la carpeta `tizen`).
5. Clic derecho sobre el proyecto → **Run As → Tizen Web Application**.
6. ¡Listo! **Karaoke en Casa** aparecerá con su propio ícono dorado en **Apps** de tu TV Samsung.
