export { default } from "./usage/host.js";
import { experimental_acpProviderBridge as acp } from "@get-bb/plugin-sdk/provider-bridge/acp";
import { experimental_defineProviderBridge } from "@get-bb/plugin-sdk/provider-bridge";
import { resolveBridgeLine } from "./scripts/managed-acp.mjs";
let dataDir = "";
export const experimental_providerBridge = experimental_defineProviderBridge({
  start(context) { dataDir = context.dataDir; acp.start?.(context); },
  handleLine(line) {
    try { acp.handleLine(resolveBridgeLine(line, dataDir)); }
    catch {
      const request = JSON.parse(line);
      if (request?.id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: "Cannot resolve installed ZCode ACP; reinstall it in the plugin settings." } }) + "\n");
    }
  },
  onClose: () => acp.onClose?.(),
  onSigterm: () => acp.onSigterm?.(),
  onSigint: () => acp.onSigint?.(),
});
