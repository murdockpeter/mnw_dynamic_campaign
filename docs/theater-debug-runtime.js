(function attachTheaterDebugRuntime(global) {
  function safeText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function extractTheaterSnapshot(payload, theaterId) {
    const snapshot = payload?.debug?.theater || null;
    if (!snapshot || snapshot.theaterId !== theaterId || !Array.isArray(snapshot.units)) {
      return null;
    }
    return snapshot;
  }

  async function loadJsonFromUrl(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Runtime snapshot request failed (${response.status}).`);
    }
    return response.json();
  }

  function readFileAsJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read snapshot file."));
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result || "")));
        } catch {
          reject(new Error("Snapshot file is not valid JSON."));
        }
      };
      reader.readAsText(file);
    });
  }

  async function applyPayload({
    payload,
    theaterId,
    statusElement,
    onSnapshot,
    sourceLabel
  }) {
    const snapshot = extractTheaterSnapshot(payload, theaterId);
    if (!snapshot) {
      safeText(statusElement, `No ${theaterId} theater snapshot found in ${sourceLabel}. Using seed ORBAT.`);
      return null;
    }
    onSnapshot(snapshot);
    safeText(
      statusElement,
      `Loaded ${snapshot.units.length} live theater units from ${sourceLabel}. Source: ${snapshot.source}.`
    );
    return snapshot;
  }

  async function autoLoadRuntime({
    theaterId,
    statusElement,
    onSnapshot,
    runtimeUrl = "../generated/ui/runtime.json"
  }) {
    try {
      const payload = await loadJsonFromUrl(new URL(runtimeUrl, global.location.href));
      return await applyPayload({
        payload,
        theaterId,
        statusElement,
        onSnapshot,
        sourceLabel: runtimeUrl
      });
    } catch {
      safeText(statusElement, "Auto-load unavailable. Using seed ORBAT until you import a runtime snapshot.");
      return null;
    }
  }

  function attachRuntimeLoader({
    theaterId,
    statusElement,
    reloadButton,
    fileInput,
    onSnapshot,
    runtimeUrl
  }) {
    if (reloadButton) {
      reloadButton.addEventListener("click", async () => {
        safeText(statusElement, "Loading generated runtime snapshot...");
        await autoLoadRuntime({ theaterId, statusElement, onSnapshot, runtimeUrl });
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }
        safeText(statusElement, `Importing ${file.name}...`);
        try {
          const payload = await readFileAsJson(file);
          await applyPayload({
            payload,
            theaterId,
            statusElement,
            onSnapshot,
            sourceLabel: file.name
          });
        } catch (error) {
          safeText(statusElement, error.message || "Unable to import snapshot JSON.");
        } finally {
          fileInput.value = "";
        }
      });
    }

    return autoLoadRuntime({ theaterId, statusElement, onSnapshot, runtimeUrl });
  }

  global.MNWTheaterDebugRuntime = {
    attachRuntimeLoader
  };
}(window));
