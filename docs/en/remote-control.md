# QR remote control

Use the CLI/ACP provider for new BB sessions. To access work already open in ZCode Desktop, use ZCode's official **Mobile Remote Control** link.

| Local CLI / ACP | QR link |
| --- | --- |
| Creates the adapter's own native sessions. | Connects the official web client to the existing Desktop window. |
| Reuses saved Desktop authorization. | Uses official browser sign-in and pairing. A persistent browser profile can keep its session. |
| Available as **ZCode CLI** in BB. | The plugin opens the web interface; remote ACP is not implemented. |

## Open the official client

1. In ZCode Desktop, open **Mobile Remote Control**.
2. Copy the current link to a UTF-8 text file outside the repository, for example `../remote-link.txt` relative to the plugin folder.
3. Validate it from the plugin folder:

   ```sh
   node bin/zcode-connect.mjs remote --link-file ../remote-link.txt
   ```

4. Open it in your default browser:

   ```sh
   node bin/zcode-connect.mjs remote --link-file ../remote-link.txt --open
   ```

5. Sign in with the same account/provider as Desktop and finish official pairing.

Only official `https://zcode.z.ai/remote/v4` links with `sid`, `mid` and `app_version` are accepted. Preserve the complete versioned URL. Do not share the link or include it in screenshots: it contains pairing identifiers.

## Avoid repeated sign-in

Use the same normal browser profile and retain its site data. Private windows or clearing cookies can require a new sign-in. The local ACP route avoids the browser pairing flow altogether while Desktop authorization remains valid.

Pairing, workspace synchronization and opening an existing idle task were observed with Desktop 3.17.2. Sending, stopping and approving real remote tasks were not tested here. The launcher does not report pairing success or provide a headless relay.

Official reference: [ZCode remote control](https://zcode.z.ai/en/docs/remote-control).
