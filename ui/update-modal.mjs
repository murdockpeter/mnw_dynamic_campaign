export function updateModalPresentation(state = {}) {
  const currentVersion = state.currentVersion || "current version";
  const availableVersion = state.availableVersion || state.downloadedVersion || "the latest version";
  const progressPercent = Math.max(0, Math.min(100, Number(state.progressPercent || 0)));

  if (!state.supported || !state.configured) {
    return { visible: false };
  }
  if (state.status === "checking") {
    return {
      visible: true,
      title: "Checking For Updates",
      status: state.message || "Checking the release channel for a newer version...",
      primaryLabel: "Checking...",
      primaryAction: "none",
      primaryDisabled: true,
      bypassDisabled: false,
      progressVisible: false,
      progressPercent
    };
  }
  if (state.status === "downloading") {
    return {
      visible: true,
      title: `Updating To ${availableVersion}`,
      status: state.message || `Downloading ${availableVersion}...`,
      primaryLabel: "Downloading & Applying...",
      primaryAction: "none",
      primaryDisabled: true,
      bypassDisabled: true,
      progressVisible: true,
      progressPercent
    };
  }
  if (state.status === "downloaded" || state.updateDownloaded) {
    return {
      visible: true,
      title: `Update ${availableVersion} Is Ready`,
      status: state.message || "The update is downloaded and ready to install.",
      primaryLabel: "Apply Update & Restart",
      primaryAction: "install",
      primaryDisabled: false,
      bypassDisabled: false,
      progressVisible: true,
      progressPercent: 100
    };
  }
  if (state.status === "available" || state.updateAvailable) {
    return {
      visible: true,
      title: `Update ${availableVersion} Available`,
      status: `You are running ${currentVersion}. Download ${availableVersion}, apply it, and restart the app now?`,
      primaryLabel: "Download & Apply Update",
      primaryAction: "download",
      primaryDisabled: false,
      bypassDisabled: false,
      progressVisible: false,
      progressPercent
    };
  }
  if (state.status === "error") {
    return {
      visible: true,
      title: "Update Check Failed",
      status: state.message || "The release channel could not be checked. You can retry or continue with this version.",
      primaryLabel: "Retry Update Check",
      primaryAction: "check",
      primaryDisabled: false,
      bypassDisabled: false,
      progressVisible: false,
      progressPercent
    };
  }
  if (state.lastCheckedAt) {
    return {
      visible: true,
      title: "Application Is Up To Date",
      status: state.message || `Version ${currentVersion} is the latest available release.`,
      primaryLabel: "Continue",
      primaryAction: "dismiss",
      primaryDisabled: false,
      bypassDisabled: false,
      progressVisible: false,
      progressPercent
    };
  }
  return {
    visible: true,
    title: "Check For Application Updates?",
    status: `You are running version ${currentVersion}. Check the configured release channel before continuing?`,
    primaryLabel: "Check For Updates",
    primaryAction: "check",
    primaryDisabled: false,
    bypassDisabled: false,
    progressVisible: false,
    progressPercent
  };
}
