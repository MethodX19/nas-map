# nas-map

Treemap tipo WinDirStat para un Synology: agrupa el espacio por disco físico (qué bahía tiene qué volúmenes y carpetas dentro) o por volumen, con transición animada entre ambas vistas.

Todo corre en el navegador. `nasmap.py` se ejecuta en el NAS por SSH, genera un JSON con la distribución de carpetas, discos y RAID, y la página lo dibuja. Nada se sube a ningún servidor externo.

*A WinDirStat-style treemap for a Synology NAS. `nasmap.py` runs over SSH and dumps a JSON with the folder/disk/RAID layout; `index.html` renders it client-side, grouped by physical disk or by volume. Nothing leaves your machine — the commands below are copy-pasteable even if you don't read Spanish.*

**Demo:** https://methodx19.github.io/nas-map/ (abre con datos de ejemplo hasta que cargues tu propio `nasmap.json`)

## Uso

1. Activa SSH en DSM: **Panel de control → Terminal y SNMP**.
2. Sube `nasmap.py` al NAS (por ejemplo con File Station, a tu carpeta `home`).
3. Por SSH:
   ```
   sudo python3 nasmap.py -o nasmap.json
   ```
   Solo lee el disco. Con muchos ficheros puede tardar varios minutos.
4. Descarga `nasmap.json` y ábrelo en `index.html` con el botón **Cargar mi JSON**, o arrástralo sobre el mapa.

## Automatizarlo

En vez de repetir los pasos 3-4 cada vez, `nasmap.py` tiene un modo `--serve` para publicar el último JSON generado, con cabecera CORS:

```
python3 nasmap.py --serve 8787 --out nasmap.json --token UNA_CLAVE_LARGA
```

Monta dos tareas en el Programador de tareas de DSM:

- Una **programada** (p. ej. diaria) que regenere el fichero: `sudo python3 nasmap.py -o nasmap.json`.
- Una **desencadenada por el evento "Arranque"** que lance el servidor de arriba y se quede corriendo.

Publica ese puerto bajo tu propio dominio HTTPS con el proxy inverso de DSM (Panel de control → Portal de inicio de sesión → Avanzado → Proxy inverso), y pega la URL resultante (con el token) en el campo de la página. A partir de ahí se actualiza sola cada vez que la abres.

El token es una protección ligera (evita que cualquiera con la URL vea el listado de carpetas), no un sistema de autenticación. El servidor escucha solo en `127.0.0.1`; la única puerta hacia fuera es la que tú abres a propósito con el proxy inverso.

Alternativa sin tocar el proxy inverso: si tienes una carpeta del NAS sincronizada en tu PC (Synology Drive, unidad de red...), programa solo la regeneración del JSON ahí dentro y usa el botón **Vincular fichero local** de la página (requiere un navegador basado en Chromium).

## Ficheros

- `index.html`, `style.css`, `app.js` — la página.
- `nasmap.py` — el escáner / servidor que corre en el NAS.

## Limitaciones conocidas

El escáner está probado en carpetas normales de Linux, no en un Synology real. Lo más propenso a fallar es cómo relaciona cada volumen con sus discos físicos (DSM 7 usa nombres como `cachedev`). Si algún disco sale mal asignado, abre un issue con la salida de `cat /proc/mounts` y `ls /sys/block`.
