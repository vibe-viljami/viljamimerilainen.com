# viljamimerilainen.com

A deliberately minimal personal landing page: black background, a serif V, and black ink suspended in white water. Move the pointer or touch the letter to stir it.

## Local development

Requires Node.js 20 or newer. There are no dependencies to install.

```sh
npm run dev
```

Open http://localhost:4173. Check syntax with `npm run check` and run the lightweight tests with `npm test`.

## Implementation

Native HTML, CSS and JavaScript. The WebGL2 fluid solver includes velocity advection, a pressure solve and vorticity confinement. The final render masks the ink to a typographic V. Touch devices use a smaller simulation grid. Animation pauses in hidden tabs. Reduced-motion preferences and unsupported graphics devices receive a still ink monogram.

The footer links to Viljami's LinkedIn and personal GitHub profiles. No analytics, cookies, external fonts or third-party scripts are included.

## Hosting

This is a static site with no build step. The runtime files are:

```text
index.html
style.css
favicon.svg
src/main.js
src/fluid.js
src/shaders.js
```

The domain and Cloudflare account have not been configured by this project. Connect the public GitHub repository to your preferred static hosting service, then attach the domain through the host's custom-domain settings. Never put Cloudflare credentials in the repository.
