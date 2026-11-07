# Plan quotas

Open **Provider usage** in BB's sidebar footer. Select the machine running ZCode, then **All** or an individual ZCode source.

<figure class="screenshot narrow">

![Coding Plan quota windows and the separate Start Plan token balance in BB](/screenshots/plan-quotas.png)

<figcaption>A user-supplied BB screenshot. Values are an observation, not a current balance or a guaranteed quota.</figcaption>
</figure>

## Reading the rows

| Row | Meaning |
| --- | --- |
| **ZCode Coding Plan** | Quota windows returned by the account service: five-hour, weekly or MCP/tools windows when present. The percentage is consumption; time indicates the service's reset. |
| **ZCode Start Plan** | Available / total model tokens, consumed percentage and grant expiry. Expiry is not a promise of renewal. |

Only the windows actually returned by the service appear. A missing weekly window is not calculated from another limit.

## Refresh and stale data

Listing sources reads local metadata. Fetching one source contacts only its plan. Normal reads can reuse a 60-second in-memory cache; **Reload provider usage** requests a fresh result. Switching the saved Desktop account invalidates the cache.

On a failed refresh, the previous successful observation can remain visible with its original timestamp. A stale row is not confirmation of the current balance. If another provider fails in the combined panel, inspect the individual ZCode tab to distinguish that error from a ZCode quota failure.

## Authorization

Credentials stay on the selected machine and come from ZCode Desktop. Quota collection does not start an ACP turn, send a model prompt, claim a promotion, switch plans or refresh the Desktop login. Reconnect expired authorization in Desktop.

The former separate `zcode-usage` plugin is unnecessary. Verify both new rows before removing an old installation.
