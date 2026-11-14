import { defineRpcContract } from "@get-bb/plugin-sdk";
import { hostContract as usageHost, rpcContract as usageRpc } from "./usage/contract.js";
import { acpHostContract, acpRpcContract } from "./acp-contract.js";
export const hostContract = defineRpcContract({ ...usageHost, ...acpHostContract });
export const rpcContract = defineRpcContract({ ...usageRpc, ...acpRpcContract });
