# Marca ONG Los Shippiyyukon y RedPanel: archivos para producción

Todas las piezas de la marca, listas para usar en `apps/web`, `apps/landing-shippiyyukon` y `apps/landing-red`.

- **Fondo transparente** en todas las piezas. La excepción son los íconos de app y los favicons: su cuadro redondeado (rojo o azul marino) es parte del dibujo.
- **Vectores originales:** se editan en el archivo de Figma «Shippi-branding», compartido con la cuenta de desarrollo. Los colores están atados a la paleta.
- **Avance:** hay 20 de 29 piezas de marca (13 de Shippiyyukon y 7 de RedPanel). Las que faltan llegarán en otros pull requests.

## Qué hay en cada carpeta

| Carpeta | Para qué sirve |
|---|---|
| `svg/` | Vectores. **Úselos siempre que se pueda**, porque se ven nítidos a cualquier tamaño. |
| `png/` | Imágenes en 2 o 3 anchos (el número en el nombre es el ancho en píxeles: `-512w`). Úselas en correos, redes y documentos. |
| `favicon/` | Ícono de la pestaña del navegador, ícono de iPhone y Android y `site.webmanifest`. |
| `tokens/` | Colores de la marca en CSS (`--shippi-rojo`), JSON y TypeScript para Tailwind. |
| `manifiesto.json` | Lista de cada pieza con su código, archivos y huella `sha256`. |

| Tipo | Archivo SVG | Cuándo usarlo |
|---|---|---|
| Logo horizontal | `svg/logo/shippiyyukon-logo-horizontal.svg` | Encabezados y pies de página (SH-01) |
| Logo vertical | `svg/logo/shippiyyukon-logo-vertical.svg` | Portadas y espacios cuadrados (SH-09) |
| Isotipo a color | `svg/isotipo/shippiyyukon-isotipo-color.svg` | Solo el dibujo, sin texto (SH-03) |
| Isotipo estrella chica | `svg/isotipo/shippiyyukon-isotipo-estrella-chica.svg` | Variante del isotipo (SH-04) |
| Isotipo negro | `svg/isotipo/shippiyyukon-isotipo-negro.svg` | Fondos claros sin color (SH-05) |
| Isotipo a una tinta | `svg/isotipo/shippiyyukon-isotipo-una-tinta.svg` | Sellos y fotocopias (SH-06) |
| Nombre | `svg/wordmark/shippiyyukon-nombre.svg` | Solo el nombre (SH-08) |
| Frase | `svg/frase/shippiyyukon-frase-juntos.svg` | «Juntos por la niñez y la adolescencia» (SH-02) |
| Ícono de app | `svg/icono-app/shippiyyukon-icono-app.svg` | Tiendas de apps y accesos directos (SH-07) |
| Favicons | `svg/favicon/favicon-*.svg` | Un dibujo distinto para cada tamaño (SH-10 a SH-13) |

### RedPanel (archivos que empiezan con `redpanel-`)

| Tipo | Archivo SVG | Cuándo usarlo |
|---|---|---|
| Logo completo | `svg/logo/redpanel-logo-horizontal.svg` | Encabezado del panel, con la frase «Gestión segura, más cerca de la niñez» (RP-01) |
| Isotipo a color | `svg/isotipo/redpanel-isotipo-color.svg` | Solo el escudo, rojo y marino (RP-02) |
| Isotipo de línea | `svg/isotipo/redpanel-isotipo-linea.svg` | Escudo a una tinta, marino (RP-03) |
| Isotipo de línea, variante | `svg/isotipo/redpanel-isotipo-linea-variante.svg` | Escudo con cortes, a una tinta (RP-04) |
| Nombre | `svg/wordmark/redpanel-nombre.svg` | Solo «RedPanel» (RP-06) |
| Ícono de app | `svg/icono-app/redpanel-icono-app.svg` | Accesos directos del panel; cuadro marino (RP-05) |
| Favicon | `svg/favicon/redpanel-favicon.svg` | Pestaña del navegador del panel; cuadro rojo (RP-07) |

Los archivos de `favicon/` (los que se copian a `public/`) siguen siendo de Shippiyyukon. Para el panel, use los PNG de `png/favicon/redpanel-favicon-*w.png`.

## Cómo usarlos en una app (Vite)

1. Copie la carpeta `favicon/` dentro de `apps/<app>/public/`.
2. En el `index.html` de esa app ponga esto:

   ```html
   <link rel="icon" href="/favicon.ico" sizes="48x48">
   <link rel="icon" href="/favicon.svg" type="image/svg+xml">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   <link rel="manifest" href="/site.webmanifest">
   ```

3. Para un logo, importe el SVG desde la raíz del repo. Ejemplo: `import logo from '../../../assets/svg/logo/shippiyyukon-logo-horizontal.svg'`. También puede copiarlo a `public/`.
4. Ponga siempre un texto alternativo: `alt="ONG Los Shippiyyukon"` o, en las piezas de RedPanel, `alt="RedPanel"`.
5. Para los colores, importe `tokens/colores.css`, o agregue `tokens/tailwind-colores.ts` en `theme.extend.colors`.

## Reglas de uso

- No cambie los colores, no estire el dibujo y no le agregue sombras.
- Deje alrededor un margen libre de al menos la mitad del alto de la estrella.
- Sobre fondos oscuros o de color, use el isotipo a una tinta, o pida la versión invertida (está en la lista de piezas que faltan).
