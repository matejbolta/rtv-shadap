import { sendRuntimeMessage } from "../shared/chrome-api";
import type { RuntimeMessage, RuntimeResponse } from "../shared/messages";
import type { SyncMode } from "../shared/models";

const form = document.querySelector<HTMLFormElement>("#sync-form");
const saveButton = form?.querySelector<HTMLButtonElement>("button[type='submit']");
const status = document.querySelector<HTMLElement>("#status");

void loadSettings();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveSettings();
});

async function loadSettings(): Promise<void> {
  const response = await sendMessage({ type: "GET_SETTINGS" });
  if (!response.ok || !("syncMode" in response)) return;
  if (response.syncMode === "browser" || response.syncMode === "local") {
    selectMode(response.syncMode);
  }
}

async function saveSettings(): Promise<void> {
  const syncMode = selectedMode();
  if (!syncMode || !saveButton) return;
  saveButton.disabled = true;
  const response = await sendMessage({ type: "SET_SYNC_MODE", syncMode });
  if (status) status.textContent = response.ok ? "Saved." : "Could not save the sync setting.";
  saveButton.disabled = false;
}

function selectedMode(): Exclude<SyncMode, "ask"> | null {
  const selected = form?.querySelector<HTMLInputElement>("input[name='sync-mode']:checked")?.value;
  return selected === "browser" || selected === "local" ? selected : null;
}

function selectMode(syncMode: Exclude<SyncMode, "ask">): void {
  const input = form?.querySelector<HTMLInputElement>(`input[name='sync-mode'][value='${syncMode}']`);
  if (input) input.checked = true;
}

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return sendRuntimeMessage<RuntimeResponse>(message).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Message failed"
  }));
}
