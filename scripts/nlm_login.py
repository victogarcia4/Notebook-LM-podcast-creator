"""
Login interactivo a NotebookLM lanzado desde la app (solo local/Windows).

Abre un Chrome persistente en notebooklm.google.com, espera a que el usuario
inicie sesión y guarda automáticamente la sesión en la ruta que lee el CLI
(~/.notebooklm/profiles/default/storage_state.json) en cuanto detecta un login
válido (cookie SID presente y la página cargada en notebooklm, no en accounts).

No requiere señal manual. Timeout de 5 minutos.
"""

import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

STORAGE_PATH = (
    Path.home() / ".notebooklm" / "profiles" / "default" / "storage_state.json"
)
PROFILE_PATH = Path.home() / ".notebooklm" / "browser_profile"
TIMEOUT_S = 300
POLL_S = 3

STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
PROFILE_PATH.mkdir(parents=True, exist_ok=True)


def has_sid(storage) -> bool:
    for c in storage.get("cookies", []):
        if c.get("name") == "SID" and "google" in c.get("domain", ""):
            return True
    return False


def main() -> int:
    print("Abriendo navegador para login de NotebookLM...")
    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_PATH),
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = browser.pages[0] if browser.pages else browser.new_page()
        page.goto("https://notebooklm.google.com/")

        deadline = time.time() + TIMEOUT_S
        stable = 0
        while time.time() < deadline:
            time.sleep(POLL_S)
            try:
                url = page.url
                storage = browser.storage_state()
            except Exception:
                continue
            on_notebooklm = "notebooklm.google.com" in url
            if on_notebooklm and has_sid(storage):
                stable += 1
                if stable >= 2:  # estable en 2 comprobaciones seguidas
                    with open(STORAGE_PATH, "w") as f:
                        json.dump(storage, f)
                    print(f"OK: sesion guardada ({len(storage.get('cookies', []))} cookies)")
                    browser.close()
                    return 0
            else:
                stable = 0

        print("TIMEOUT: no se detecto un login valido a tiempo.")
        browser.close()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
