import { definePluginApp } from "@get-bb/plugin-sdk/app";

function ZCodeGuide() {
  return (
    <div className="flex flex-col gap-4 text-sm">
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
        Advanced launch options belong to the ACP agent configuration.
        <br />
        Дополнительные параметры запуска задаются в настройках ACP-агента.
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
