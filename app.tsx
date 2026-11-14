import { useCallback, useEffect, useRef, useState } from "react";
import { definePluginApp, useRpc, useSettings } from "@get-bb/plugin-sdk/app";
import { acpRpcContract } from "./acp-contract.js";
import type { z } from "zod";
import type { acpStatus } from "./acp-contract.js";

const labels = {
  ru: { computer: "Компьютер", current: "Используется", latest: "Последняя версия", managed: "Установлен плагином", missing: "Не установлен", noRelease: "Релиз ещё не опубликован", pending: "Бинарники ещё собираются", install: "Установить", update: "Обновить", check: "Проверить обновления", use: "Использовать установленный ACP", working: "Выполняется…", loading: "Загрузка…", empty: "Нет подключённых компьютеров", offline: "не в сети", ready: "Установлена версия", active: "Последняя версия установлена", target: "Платформа", link: "Релизы", custom: "Указанный путь имеет приоритет. Чтобы использовать скачанный ACP, нажмите «Использовать установленный ACP» — поле ACP executable будет очищено для всех компьютеров.", note: "Установка выполняется на выбранном компьютере. Новые чаты, модели и квоты используют установленный ACP, если поле ACP executable пустое. Работающие чаты продолжают использовать прежний бинарник.", sources: { custom: "указанный путь", managed: "установлен плагином", path: "из PATH" } },
  en: { computer: "Computer", current: "In use", latest: "Latest version", managed: "Installed by plugin", missing: "Not installed", noRelease: "No published release yet", pending: "Binaries are still building", install: "Install", update: "Update", check: "Check for updates", use: "Use installed ACP", working: "Working…", loading: "Loading…", empty: "No connected computers", offline: "offline", ready: "Installed version", active: "Latest version installed", target: "Platform", link: "Releases", custom: "The custom path has priority. To use the downloaded ACP, click “Use installed ACP”; this clears ACP executable for all computers.", note: "Installs on the selected computer. New chats, model discovery and quotas use the installed ACP when ACP executable is empty. Running chats keep their previous binary.", sources: { custom: "custom path", managed: "installed by plugin", path: "from PATH" } },
};

function AcpSettings() {
  const rpc = useRpc<typeof acpRpcContract>();
  const settings = useSettings();
  const [language, setLanguage] = useState<"ru" | "en">(() => typeof navigator !== "undefined" && navigator.language.startsWith("ru") ? "ru" : "en");
  const text = labels[language];
  const [hosts, setHosts] = useState<{ id: string; name: string; connected: boolean }[]>([]);
  const [hostId, setHostId] = useState("");
  const [data, setData] = useState<z.infer<typeof acpStatus> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const connected = hosts.some(host => host.id === hostId && host.connected);

  async function check() {
    if (connected) { await load(true); return; }
    setBusy(true); setError("");
    try {
      const result = await rpc.call("acp.hosts", {});
      setHosts(result.hosts);
      setHostId(result.hosts.find(host => host.connected)?.id ?? "");
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    rpc.call("acp.hosts", {}).then(result => {
      if (cancelled) return;
      setHosts(result.hosts);
      setHostId(result.hosts.find(host => host.connected)?.id ?? "");
    }).catch(err => { if (!cancelled) setError(String(err.message || err)); });
    return () => { cancelled = true; generation.current++; };
  }, [rpc]);

  const load = useCallback(async (refresh = false) => {
    if (!hostId || !connected) return;
    const request = ++generation.current;
    setBusy(true); setError("");
    try {
      const result = await rpc.call("acp.status", { hostId, refresh });
      if (request === generation.current) setData(result);
    } catch (err) { if (request === generation.current) setError(err instanceof Error ? err.message : String(err)); }
    finally { if (request === generation.current) setBusy(false); }
  }, [rpc, hostId, connected]);

  useEffect(() => { setData(null); setNotice(""); void load(); return () => { generation.current++; }; }, [load, settings.values?.acpCommand]);

  async function install() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await rpc.call("acp.install", { hostId });
      setNotice(`${text.ready} ${result.version}`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  async function useManaged() {
    setBusy(true); setError("");
    try { await rpc.call("acp.useManaged", { hostId }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  const upToDate = Boolean(data?.managed && data.latest?.version === data.managed.version);
  const button = "rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 text-sm" aria-busy={busy}>
      <div className="flex items-center justify-between gap-3">
        <strong>zcode-acp · Rust</strong>
        <select aria-label="Language" value={language} onChange={event => setLanguage(event.target.value as "ru" | "en")} className="rounded border bg-background px-2 py-1"><option value="ru">RU</option><option value="en">EN</option></select>
      </div>
      <label className="flex flex-wrap items-center gap-2">{text.computer}
        <select className="min-w-0 max-w-full rounded border bg-background px-2 py-1" value={hostId} onChange={event => setHostId(event.target.value)} disabled={busy}>
          {!hosts.length && <option value="">{text.empty}</option>}
          {hosts.map(host => <option key={host.id} value={host.id} disabled={!host.connected}>{host.name}{host.connected ? "" : ` (${text.offline})`}</option>)}
        </select>
      </label>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt>{text.current}</dt><dd>{data?.current ? `${data.current.version} (${text.sources[data.current.source]})` : busy ? text.loading : data ? text.missing : "—"}</dd>
        <dt>{text.latest}</dt><dd>{data?.releaseError ? "—" : data?.latest ? `${data.latest.version}${data.latest.ready ? "" : ` · ${text.pending}`}` : busy ? text.loading : data ? text.noRelease : "—"}</dd>
        {data?.managed && <><dt>{text.managed}</dt><dd>{data.managed.version}</dd></>}
        {data?.target && <><dt>{text.target}</dt><dd className="break-all">{data.target}</dd></>}
      </dl>
      {data?.current && <code className="break-all text-xs text-muted-foreground">{data.current.executable}</code>}
      {data?.currentError && <p className="break-words text-muted-foreground">{data.currentError}</p>}
      {data && !data.target && <p role="status">{language === "ru" ? "Для этой платформы пока нет готового бинарника." : "No binary is available for this platform yet."}</p>}
      {data?.releaseError && <p role="alert" className="break-words text-destructive">{data.releaseError}</p>}
      {error && <p role="alert" className="break-words text-destructive">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void check()}>{busy ? text.working : text.check}</button>
        <button className={button} disabled={busy || !connected || !data?.target || !data.latest?.ready || upToDate} onClick={() => void install()}>{data?.managed ? text.update : text.install}</button>
        {data?.managed && settings.values?.acpCommand && <button className={button} disabled={busy} onClick={() => void useManaged()}>{text.use}</button>}
      </div>
      {upToDate && <p className="text-muted-foreground">{text.active}</p>}
      {data?.managed && settings.values?.acpCommand && <p className="text-muted-foreground">{text.custom}</p>}
      <p className="text-muted-foreground">{text.note}</p>
      <a className="underline" href="https://github.com/ichinya/zcode-acp/releases" target="_blank" rel="noopener noreferrer">{text.link}</a>
    </div>
  );
}

function ZCodeGuide() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <AcpSettings />
      <p>
        Select <strong>ZCode CLI</strong> in a new chat. Model, plan, reasoning and
        permissions are selected in the chat.
      </p>
      <p>
        Выберите <strong>ZCode CLI</strong> в новом чате. Модель, план, reasoning и
        разрешения выбираются в чате.
      </p>
      <div className="rounded-md border p-3">
        <p><strong>Coding Plan / Start Plan</strong></p>
        <p className="mt-1 text-muted-foreground">
          Quotas: Provider usage in the sidebar. Sign in through ZCode Desktop.
          <br />
          Квоты: Provider usage в боковой панели. Вход — через ZCode Desktop.
        </p>
      </div>
      <p className="text-muted-foreground">
        The adapter uses ZCode's bundled runtime automatically.
        <br />
        Адаптер автоматически использует runtime самого ZCode.
      </p>
      <p className="text-muted-foreground">
        ACP executable: leave empty for the installed ACP, then PATH, or enter its full path.
        ZCode CLI path points separately to resources/glm/zcode.cjs.
        <br />
        Исполняемый файл ACP: пусто — установленный ACP, затем PATH; либо укажите полный путь.
        Путь к CLI ZCode задаёт отдельно resources/glm/zcode.cjs.
      </p>
      <div className="flex gap-4">
        <a className="underline" href="https://ichinya.github.io/bb-plugin-zcode/en/configuration.html" target="_blank" rel="noopener noreferrer">Documentation (EN)</a>
        <a className="underline" href="https://ichinya.github.io/bb-plugin-zcode/ru/configuration.html" target="_blank" rel="noopener noreferrer">Документация (RU)</a>
      </div>
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.settingsSection({
    id: "zcode-guide",
    title: "ZCode CLI",
    description: "Configuration in the chat / Настройка в чате",
    component: ZCodeGuide,
  });
});
