# Roma's Donuts Android ordering app

This is a Trusted Web Activity built with Bubblewrap 1.27.0. It opens the live ordering site at `https://rd-business-system.vercel.app/customer-ordering-preview/`. Customers need an internet connection to place orders. The package ID is `com.romasdonuts.ordering`, and Android 7.0 (API 24) or later is required.

The public release APK is `public/customer-ordering-preview/Romas-Ordering.apk`. The site publishes `public/.well-known/assetlinks.json` with the release certificate fingerprint so the site opens as a verified Trusted Web Activity. Update that fingerprint if the signing certificate changes.

The signing keystore is deliberately outside this repository. On the build computer it is under the Windows user's `.codex/signing-keys/` directory, along with a password encrypted for that Windows account. Preserve the same keystore and password for future updates; an APK signed with a different key cannot update an existing installation. Never commit the keystore or password.

For a new release, increase `appVersionCode` in `twa-manifest.json`, run `npx @bubblewrap/cli@1.27.0 update --skipVersionUpgrade`, build the release APK, sign it with the original keystore, verify it with `apksigner verify --verbose --print-certs`, and copy it to the public release path. Check that the certificate fingerprint still matches `assetlinks.json` before deployment.
