#!/usr/bin/env python3
"""nasmap.py - escanea los volumenes de un Synology y genera un JSON
para el visor "Mapa del NAS" (que disco fisico tiene cada cosa).

Uso (por SSH en el NAS):
    sudo python3 nasmap.py -o /volume1/homes/TU_USUARIO/nasmap.json
Opciones:
    --vol volume1 volume3   escanear solo esos volumenes
    --path /ruta            escanear una carpeta suelta (sin mapa de discos)
    --depth 7               niveles de carpetas que se guardan (el resto se agrupa)
    --min-file 256          ficheros de mas de N MB aparecen sueltos
    --exclude @docker "#recycle"   nombres de carpeta a saltar (admite comodines, p.ej. "@*")

Para que la pagina web se actualice sola (sin subir el JSON a mano),
dos tareas en el Programador de tareas de DSM:
    1) programada (p.ej. diaria):  sudo python3 nasmap.py -o nasmap.json
    2) al arrancar (desencadenada):  python3 nasmap.py --serve 8787 --out nasmap.json --token CLAVE
       y publica ese puerto con el proxy inverso de DSM bajo tu dominio HTTPS.

Solo lee. No modifica nada salvo el fichero de salida.
"""
import argparse, fnmatch, json, os, re, socket, stat, subprocess, sys, time

CATS = {
    'video': 'mkv mp4 avi mov m4v wmv flv webm mpg mpeg ts m2ts vob 3gp rmvb divx',
    'audio': 'mp3 flac wav aac m4a ogg opus wma alac aiff ape',
    'imagen': 'jpg jpeg png gif heic heif raw cr2 cr3 nef arw dng orf tif tiff bmp webp psd',
    'documento': 'pdf doc docx xls xlsx ppt pptx odt ods odp txt md rtf csv epub mobi',
    'archivo': 'zip rar 7z tar gz tgz bz2 xz zst iso img dmg vmdk qcow2 vdi vhd vhdx hbk bak',
    'codigo': 'py js ts jsx tsx php html css json xml yml yaml sh c h cpp java go rs rb sql pack idx',
}
EXT = {e: c for c, es in CATS.items() for e in es.split()}
SYS_NAMES = {'#recycle', '#snapshot', 'lost+found', '@eaDir', 'aquota.user',
             'aquota.group', 'synoquota.db', '.DS_Store'}


def is_sys(name):
    return name.startswith('@') or name in SYS_NAMES


def read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return ''


class Scanner:
    def __init__(self, skip, depth, min_file, exclude=()):
        self.skip, self.depth, self.min_file = skip, depth, min_file
        self.exclude = exclude
        self.seen = set()
        self.files = 0
        self.errors = 0
        self.samples = []
        self.last = time.time()

    def err(self, path, e):
        self.errors += 1
        if len(self.samples) < 25:
            self.samples.append('%s: %s' % (path, e.strerror or e))

    def tick(self):
        now = time.time()
        if now - self.last > 2:
            self.last = now
            sys.stderr.write('\r  %d ficheros, %d errores...' % (self.files, self.errors))
            sys.stderr.flush()

    def scan(self, path, name, level, system):
        kids, loose, counts, cats = [], {}, {}, {}
        total = 0
        try:
            it = os.scandir(path)
        except OSError as e:
            self.err(path, e)
            return {'n': name, 's': 0, 'c': 'sistema' if system else 'otros', 'e': 1, '_c': {}}
        with it:
            for de in it:
                try:
                    st = de.stat(follow_symlinks=False)
                except OSError as e:
                    self.err(de.path, e)
                    continue
                if stat.S_ISDIR(st.st_mode):
                    if de.path in self.skip:
                        continue
                    if self.exclude and any(fnmatch.fnmatch(de.name, pat) for pat in self.exclude):
                        continue
                    kid = self.scan(de.path, de.name, level + 1, system or is_sys(de.name))
                    if system or is_sys(de.name):
                        kid['y'] = 1
                    total += kid['s']
                    for c, v in kid['_c'].items():
                        cats[c] = cats.get(c, 0) + v
                    kids.append(kid)
                elif stat.S_ISREG(st.st_mode):
                    if st.st_nlink > 1:
                        key = (st.st_dev, st.st_ino)
                        if key in self.seen:
                            continue
                        self.seen.add(key)
                    size = st.st_blocks * 512
                    if system or is_sys(de.name):
                        c = 'sistema'
                    else:
                        c = EXT.get(os.path.splitext(de.name)[1][1:].lower(), 'otros')
                    total += size
                    cats[c] = cats.get(c, 0) + size
                    self.files += 1
                    if size >= self.min_file:
                        kids.append({'n': de.name, 's': size, 'c': c, 'f': 1, '_c': {c: size}})
                    else:
                        loose[c] = loose.get(c, 0) + size
                        counts[c] = counts.get(c, 0) + 1
                    self.tick()
        for c, size in loose.items():
            if size:
                kids.append({'n': 'Ficheros pequeños', 's': size, 'c': c, 'b': counts[c], '_c': {c: size}})
        dom = max(cats, key=cats.get) if cats else ('sistema' if system else 'otros')
        node = {'n': name, 's': total, 'c': dom, '_c': cats}
        if level < self.depth and kids:
            node['k'] = kids
        return node


def prune(node, min_size, max_kids):
    kids = node.get('k')
    if kids:
        kids.sort(key=lambda k: k['s'], reverse=True)
        keep, rest = [], []
        for k in kids:
            (keep if k['s'] >= min_size and len(keep) < max_kids else rest).append(k)
        if len(rest) == 1:
            keep.append(rest[0])
        elif rest:
            cats = {}
            for r in rest:
                for c, v in r['_c'].items():
                    cats[c] = cats.get(c, 0) + v
            keep.append({'n': 'Otros (%d elementos)' % len(rest), 's': sum(r['s'] for r in rest),
                         'c': max(cats, key=cats.get) if cats else 'otros', 'o': 1, '_c': cats})
        node['k'] = keep
        for k in keep:
            prune(k, min_size, max_kids)
    node.pop('_c', None)
    return node


# ---------- mapa volumen -> discos fisicos (sysfs) ----------
def blk(name):
    return '/sys/class/block/' + name


def sysfs_name(dev_path):
    """Nombre real en /sys/block de un fichero de /dev, buscando por su
    numero mayor:menor. En DSM /dev/mapper/cachedev_N no es un symlink
    (es un nodo de dispositivo con otro nombre que el de /sys/block), asi
    que resolver por ruta como con os.path.realpath() no funciona."""
    try:
        st = os.stat(dev_path)
        link = '/sys/dev/block/%d:%d' % (os.major(st.st_rdev), os.minor(st.st_rdev))
        return os.path.basename(os.path.realpath(link))
    except OSError:
        return os.path.basename(dev_path)


def dm_deps(name):
    """De que dispositivos depende uno de device-mapper (dmsetup deps),
    para cuando /sys/block/<nombre>/slaves/ no esta poblado."""
    for exe in ('dmsetup', '/sbin/dmsetup', '/usr/sbin/dmsetup'):
        try:
            out = subprocess.run([exe, 'deps', '-o', 'devname', name],
                                 capture_output=True, text=True, timeout=10).stdout
        except OSError:
            continue
        if out:
            return re.findall(r'\(([^)]+)\)', out)
    return []


def slaves(name):
    try:
        s = sorted(os.listdir(blk(name) + '/slaves'))
        if s:
            return s
    except OSError:
        pass
    return dm_deps(name)


def leaves(name):
    s = slaves(name)
    if not s:
        return [name]
    out = []
    for x in s:
        out.extend(leaves(x))
    return out


def raid_levels(name, acc):
    if name.startswith('md'):
        lvl = read('/sys/block/%s/md/level' % name)
        if lvl:
            acc.add(lvl)
    for x in slaves(name):
        raid_levels(x, acc)
    return acc


def parent_disk(part):
    p = blk(part)
    if os.path.exists(p + '/partition'):
        return os.path.basename(os.path.dirname(os.path.realpath(p)))
    return part


def smart_serial(disk):
    for exe in ('/usr/bin/smartctl', '/usr/syno/bin/smartctl', '/usr/sbin/smartctl'):
        if not os.path.exists(exe):
            continue
        for extra in ([], ['-d', 'sat']):
            try:
                out = subprocess.run([exe, '-i'] + extra + ['/dev/' + disk], capture_output=True,
                                     text=True, timeout=15).stdout
            except Exception:
                continue
            m = re.search(r'Serial Number:\s*(\S+)', out)
            if m:
                return m.group(1)
    return ''


def disk_info(d):
    dev = '/sys/block/%s/device/' % d
    return {
        'id': d,
        'model': ' '.join(x for x in (read(dev + 'vendor'), read(dev + 'model')) if x and x != 'ATA'),
        'serial': read(dev + 'serial') or smart_serial(d),
        'size': int(read('/sys/block/%s/size' % d) or 0) * 512,
        'rot': read('/sys/block/%s/queue/rotational' % d) == '1',
    }


def all_disks():
    out = []
    for d in sorted(os.listdir('/sys/block')):
        if re.match(r'^(sata\d+|sd[a-z]+|nvme\d+n\d+)$', d) and os.path.exists('/sys/block/%s/device' % d):
            out.append(d)
    return out


def other_mounts(root):
    """Puntos de montaje reales dentro de root (algo montado aparte,
    como un NFS/USB metido dentro de una carpeta compartida), para
    no cruzar a ellos. No vale comparar st_dev: en Btrfs cada
    subvolumen (cada carpeta compartida) tiene un st_dev distinto al
    del volumen aunque sea el mismo disco y no un montaje aparte."""
    root = root.rstrip('/')
    out = set()
    for line in read('/proc/mounts').splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        mnt = parts[1]
        if mnt != root and (mnt + '/').startswith(root + '/'):
            out.add(mnt)
    return out


def volume_mounts(only):
    vols = []
    for line in read('/proc/mounts').splitlines():
        parts = line.split()
        if len(parts) < 3 or not re.match(r'^/volume\d+$', parts[1]):
            continue
        name = parts[1].lstrip('/')
        if only and name not in only:
            continue
        vols.append((name, parts[0], parts[1], parts[2]))
    return sorted(vols, key=lambda v: int(re.sub(r'\D', '', v[0]) or 0))


# ---------- servir el JSON ya generado, con CORS (tarea "al arrancar") ----------
def serve_forever(path, port, bind, token):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import urlparse, parse_qs

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            q = parse_qs(urlparse(self.path).query)
            if token and q.get('token', [''])[0] != token:
                self.send_response(403)
                self.end_headers()
                return
            try:
                with open(path, 'rb') as f:
                    data = f.read()
            except OSError:
                self.send_response(404)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *a):
            pass

    sys.stderr.write('Sirviendo %s en http://%s:%d (Ctrl+C para parar)\n' % (path, bind, port))
    ThreadingHTTPServer((bind, port), Handler).serve_forever()


def main():
    ap = argparse.ArgumentParser(description='Mapa del NAS: genera el JSON para el visor.')
    ap.add_argument('-o', '--out', default='nasmap.json')
    ap.add_argument('--vol', nargs='*', default=[])
    ap.add_argument('--path', help='escanear una carpeta suelta')
    ap.add_argument('--depth', type=int, default=7)
    ap.add_argument('--min-file', type=int, default=256, help='MB')
    ap.add_argument('--exclude', nargs='*', default=[],
                     help='nombres de carpeta a saltar, admite comodines (p.ej. @docker "#recycle" "@*")')
    ap.add_argument('--serve', type=int, metavar='PORT',
                     help='no escanea: sirve el --out actual con cabecera CORS (usalo en una tarea "al arrancar")')
    ap.add_argument('--token', default='', help='clave que debe venir en la URL (?token=...) para servir el fichero')
    ap.add_argument('--bind', default='127.0.0.1',
                     help='IP donde escucha --serve (127.0.0.1 si lo publicas con el proxy inverso de DSM)')
    args = ap.parse_args()

    if args.serve:
        serve_forever(args.out, args.serve, args.bind, args.token)
        return

    result = {'tool': 'nasmap', 'version': 1, 'host': socket.gethostname(),
              'generated': time.strftime('%Y-%m-%dT%H:%M:%S'), 'disks': [], 'volumes': []}

    if args.path:
        targets = [(os.path.basename(args.path.rstrip('/')) or args.path, None, args.path, '')]
    else:
        targets = volume_mounts(set(args.vol))
        if not targets:
            sys.exit('No encuentro volúmenes /volumeN montados. ¿Estás en el NAS? Usa --path para una carpeta.')

    used_disks = set()
    for name, dev, mnt, fs in targets:
        sys.stderr.write('Escaneando %s ...\n' % mnt)
        vfs = os.statvfs(mnt)
        vol = {'id': name, 'mount': mnt, 'fs': fs,
               'total': vfs.f_blocks * vfs.f_frsize,
               'used': (vfs.f_blocks - vfs.f_bfree) * vfs.f_frsize,
               'raid': '', 'parts': []}
        if dev:
            top = sysfs_name(dev)
            vol['raid'] = '+'.join(sorted(raid_levels(top, set())))
            for part in leaves(top):
                disk = parent_disk(part)
                used_disks.add(disk)
                vol['parts'].append({'disk': disk, 'part': part,
                                     'size': int(read(blk(part) + '/size') or 0) * 512})
        sc = Scanner(other_mounts(mnt), args.depth, args.min_file * 1024 * 1024, args.exclude)
        tree = sc.scan(mnt, name, 0, False)
        sys.stderr.write('\r  %d ficheros, %d errores. Hecho.          \n' % (sc.files, sc.errors))
        min_size = max(vol['used'] * 0.0004, 32 * 1024 * 1024)
        vol['tree'] = prune(tree, min_size, 150)
        vol['files'] = sc.files
        vol['errors'] = sc.errors
        vol['error_samples'] = sc.samples
        result['volumes'].append(vol)

    if not args.path:
        for d in sorted(set(all_disks()) | used_disks):
            result['disks'].append(disk_info(d))

    tmp = args.out + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, args.out)
    sys.stderr.write('JSON guardado en %s (%.1f MB)\n' % (args.out, os.path.getsize(args.out) / 1e6))


if __name__ == '__main__':
    main()
