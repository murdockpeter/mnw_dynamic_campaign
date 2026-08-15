const port = Number(process.argv[2] || 9333);
const action = process.argv[3] || "state";
const timeoutMs = Number(process.argv[4] || 120000);

const actions = {
  state: "window.mnwDesktop.getUpdateState()",
  check: "window.mnwDesktop.checkForUpdates()",
  download: "window.mnwDesktop.downloadUpdate()",
  install: "window.mnwDesktop.installUpdate()"
};

if (!actions[action]) {
  throw new Error(`Unknown updater action: ${action}`);
}

async function findPage() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const page = pages.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* The packaged app may still be starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No packaged app debug page appeared on port ${port}.`);
}

async function evaluate(page, expression) {
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const response = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Updater ${action} timed out.`)), timeoutMs);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression,
          awaitPromise: true,
          returnByValue: true
        }
      }));
    });
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data));
      if (payload.id !== 1) return;
      clearTimeout(timeout);
      if (payload.error || payload.result?.exceptionDetails) {
        reject(new Error(JSON.stringify(payload.error || payload.result.exceptionDetails)));
      } else {
        resolve(payload.result?.result?.value);
      }
    });
    socket.addEventListener("error", () => reject(new Error("Debug websocket failed.")));
  });
  socket.close();
  return response;
}

const page = await findPage();
const value = await evaluate(page, actions[action]);
process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
