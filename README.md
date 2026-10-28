# Porotos List

Demon list del GDPS de los porotos, con estética Frutiger Aero.

Es un sitio estático (HTML + CSS + JS, sin build ni dependencias). Todos los datos están en
[`data/levels.json`](data/levels.json), y el orden del array `levels` es el ranking.

## Wallpaper y logo

Poné tus imágenes en [`common/`](common/):

- `wallpaper.jpg`: fondo de la página.
- `wallpaper-noche.jpg` (opcional): fondo del tema noche.
- `logo.png` (opcional): logo de la barra de título.

Si tu wallpaper es `.png` o `.webp`, cambiá la extensión en `--wallpaper`, al principio de
[`css/aero.css`](css/aero.css).

## Editar la lista

```bash
npm start
```

Abrí <http://localhost:3000/admin.html>. Desde ahí podés:

- **Agregar un nivel**: botón “Agregar nivel”, elegís en qué puesto entra.
- **Moverlo de puesto**: arrastrándolo desde ⠿, con las flechas ▲▼ o escribiendo el número de puesto.
- **Anotar completions**: botón “Victors” en cada nivel (jugador, fecha y video). El verificador cuenta solo.
- **Editar o sacar** niveles, y cambiar el título, el nombre del GDPS y el texto de Info desde “ajustes”.

Los cambios no se aplican hasta que tocás **Guardar** (o `Ctrl+S`), que escribe `data/levels.json`.
Si cerrás la pestaña sin guardar, al volver te ofrece recuperar el borrador.

Las altas, bajas y movimientos quedan registrados solos en la sección **Novedades**.

Para publicarlo, commiteá y pusheá el `levels.json`:

```bash
git add data/levels.json
git commit -m "Agrego <nivel>"
git push
```

> Si abrís `admin.html` sin el servidor (por ejemplo en el sitio publicado), “Guardar” descarga
> un `levels.json` que tenés que poner a mano en `data/`.

## Publicar en GitHub Pages

1. Subí el repo a GitHub.
2. *Settings → Pages → Build and deployment*: “Deploy from a branch”, rama `main`, carpeta `/ (root)`.
3. Queda en `https://<usuario>.github.io/porotoslist/`.

## Puntos

El #1 da 500 puntos y el último 150; el resto cae en una curva entre medio según el puesto,
así que los puntos se reacomodan cuando entra un nivel nuevo (verificador incluido).
La fórmula está en `pointsFor` dentro de [`js/common.js`](js/common.js).

## Estructura

```
index.html        lista pública (niveles, leaderboard, novedades, info)
admin.html        panel para editar
common/           tu wallpaper y logo
css/aero.css      todo el estilo (tema día y noche)
js/common.js      helpers compartidos e íconos
js/app.js         lista pública
js/admin.js       panel admin
server.js         servidor local que guarda data/levels.json
data/levels.json  los datos
```
