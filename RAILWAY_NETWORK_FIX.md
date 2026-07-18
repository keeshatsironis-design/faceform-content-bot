# Railway npm ETIMEDOUT fix

This project was corrected to use the public npm registry.

Changes:
- all internal registry URLs in `package-lock.json` were replaced with `https://registry.npmjs.org/`;
- `.npmrc` explicitly selects the public registry and enables retries;
- the Dockerfile installs dependencies once, then copies production dependencies into the final image.

After uploading these files to GitHub, trigger a fresh Railway deployment.
