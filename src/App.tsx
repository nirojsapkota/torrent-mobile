/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from "react";
import {
  Download,
  Upload,
  Play,
  Pause,
  Trash2,
  Plus,
  Search,
  Settings,
  Wifi,
  Battery,
  Share2,
  FileText,
  CheckCircle,
  DownloadCloud,
  HardDrive,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  X,
  Info,
  FolderOpen,
  Volume2,
  ListFilter,
  MonitorCheck,
  ShieldCheck,
  Percent,
  Sliders,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { App as CapacitorApp } from "@capacitor/app";
import { registerPlugin, Capacitor } from "@capacitor/core";

interface FileExplorerPlugin {
  openFolder(options: { path: string }): Promise<void>;
  listFolder(options: { path: string }): Promise<{ folders: { name: string; path: string }[] }>;
  openFile(options: { path: string }): Promise<void>;
}

interface TorrentPlugin {
  addTorrent(options: { magnetUri: string, path: string }): Promise<void>;
  getStats(): Promise<{ torrents: any[] }>;
  pauseTorrent(options: { infoHash: string }): Promise<void>;
  resumeTorrent(options: { infoHash: string }): Promise<void>;
  removeTorrent(options: { infoHash: string; withFiles?: boolean }): Promise<void>;
  setFilePriority(options: { infoHash: string; fileIndex: number; priority: string }): Promise<void>;
  setSequentialDownload(options: { infoHash: string; sequential: boolean }): Promise<void>;
  setWifiOnly(options: { wifiOnly: boolean }): Promise<void>;
  setBatterySaveMode(options: { enabled: boolean }): Promise<void>;
}

const FileExplorer = registerPlugin<FileExplorerPlugin>("FileExplorer");
const Torrent = registerPlugin<TorrentPlugin>("Torrent");

// Types definition for our torrent ecosystem
interface TorrentFile {
  name: string;
  size: number;
  downloaded: number;
  priority: "high" | "normal" | "low" | "skip";
  fileIndex: number;
}

interface Peer {
  ip: string;
  client: string;
  dlSpeed: number; // bytes/sec
  ulSpeed: number; // bytes/sec
  progress: number; // 0 - 100
  country: string;
  countryCode: string;
}

interface TorrentItem {
  id: string;
  name: string;
  status: "downloading" | "completed" | "paused" | "seeding" | "checking" | "error";
  infoHash: string;
  addedDate: string;
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number; // bytes/sec
  downloaded: number; // bytes
  uploaded: number; // bytes
  totalSize: number; // bytes
  peersActive: number;
  peersTotal: number;
  seedsActive: number;
  seedsTotal: number;
  ratio: number;
  magnetURI: string;
  files: TorrentFile[];
  peersList: Peer[];
  speedHistory: { dl: number; ul: number }[];
  playableUrl?: string; // Real video URL if torrent completes
  category: "media" | "software" | "other";
  savePath: string;
}

// Preset Payloads for immediate interactivity
const PRESET_TORRENTS = [
  {
    name: "Big Buck Bunny 4K (CC Video Suite)",
    hash: "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    size: 276192000, // 276 MB
    seeds: 284,
    peers: 76,
    category: "media" as const,
    playableUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    files: [
      { name: "big_buck_bunny_1080p_h264.mp4", size: 275800000, downloaded: 0, priority: "normal" as const },
      { name: "bunny_poster_art.png", size: 372000, downloaded: 0, priority: "normal" as const },
      { name: "license_creative_commons_30.txt", size: 20000, downloaded: 0, priority: "normal" as const }
    ]
  },
  {
    name: "Sintel CGI Open Source Movie (HEVC)",
    hash: "b3f46f3a47da1ea2c39d73d611ee212a4f494951",
    size: 681574800, // 681.5 MB
    seeds: 142,
    peers: 32,
    category: "media" as const,
    playableUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    files: [
      { name: "sintel_cc_1080p_hevc.mkv", size: 680240000, downloaded: 0, priority: "normal" as const },
      { name: "sintel_cover_artwork.jpg", size: 1230000, downloaded: 0, priority: "normal" as const },
      { name: "creative_commons_attribution.txt", size: 104800, downloaded: 0, priority: "normal" as const }
    ]
  },
  {
    name: "Ubuntu ISO 24.04 LTS Desktop (64-bit)",
    hash: "f8a48fc572f260be347cd37dfcc9549cd5409b35",
    size: 4398046592, // 4.1 GB
    seeds: 1240,
    peers: 418,
    category: "software" as const,
    files: [
      { name: "ubuntu-24.04-desktop-amd64.iso", size: 4398000000, downloaded: 0, priority: "normal" as const },
      { name: "SHA256SUMS", size: 41200, downloaded: 0, priority: "normal" as const },
      { name: "README.diskdefines", size: 5392, downloaded: 0, priority: "normal" as const }
    ]
  },
  {
    name: "Arch Linux Netboot Mini-Image (64-bit)",
    hash: "ea902f4318cfa52bf3386e885d9c22881a5fc54e",
    size: 98416218, // 94 MB
    seeds: 95,
    peers: 14,
    category: "software" as const,
    files: [
      { name: "archlinux-netboot-2026.06.01.tar.gz", size: 98400000, downloaded: 0, priority: "normal" as const },
      { name: "gpg_signature.sig", size: 16218, downloaded: 0, priority: "normal" as const }
    ]
  }
];

export default function App() {
  // Application torrent lists and filters
  const [torrents, setTorrents] = useState<TorrentItem[]>(() => {
    const saved = localStorage.getItem("opentorrent_history");
    return saved ? JSON.parse(saved) : [];
  });

  // Persist history
  useEffect(() => {
    localStorage.setItem("opentorrent_history", JSON.stringify(torrents));
  }, [torrents]);

  // Main navigation filters
  const [activeFilter, setActiveFilter] = useState<"all" | "downloading" | "completed" | "paused">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTorrentId, setSelectedTorrentId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"files" | "peers" | "info" | "traffic">("files");

  // Modern UI Dialog overlays
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showActiveVideo, setShowActiveVideo] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [currentPickerPath, setCurrentPickerPath] = useState("/storage/emulated/0");
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [deleteWithFiles, setDeleteWithFiles] = useState(false);
  const [pickerFolders, setPickerFolders] = useState<{ name: string; path: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // New torrent creation inputs
  const [magnetInput, setMagnetInput] = useState("");
  const [customPath, setCustomPath] = useState(
    () => localStorage.getItem("opentorrent_save_path") || "/storage/emulated/0/Download"
  );
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Persist save path whenever it changes
  useEffect(() => {
    localStorage.setItem("opentorrent_save_path", customPath);
  }, [customPath]);

  // Client speed limitation parameters & power optimization
  const [downloadLimit, setDownloadLimit] = useState<number>(0); // 0 means Unlimited
  const [uploadLimit, setUploadLimit] = useState<number>(0); // 0 means Unlimited
  const [wifiOnly, setWifiOnly] = useState<boolean>(() => {
    return localStorage.getItem("opentorrent_wifi_only") === "true";
  });
  const [batterySaveMode, setBatterySaveMode] = useState<boolean>(() => {
    return localStorage.getItem("opentorrent_battery_save") !== "false"; // Default to true
  });
  const [disableTimer, setDisableTimer] = useState<boolean>(false);

  // Persist settings and sync with native
  useEffect(() => {
    localStorage.setItem("opentorrent_wifi_only", wifiOnly.toString());
    Torrent.setWifiOnly({ wifiOnly }).catch(console.error);
  }, [wifiOnly]);

  useEffect(() => {
    localStorage.setItem("opentorrent_battery_save", batterySaveMode.toString());
    Torrent.setBatterySaveMode({ enabled: batterySaveMode }).catch(console.error);
  }, [batterySaveMode]);

  // Hardware state capture (Battery percentage & Charging feedback)
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  const [isCharging, setIsCharging] = useState<boolean>(true);
  const [networkType, setNetworkType] = useState<"Wi-Fi" | "Mobile Data">("Wi-Fi");

  // Simulated Speed Graphs continuous tracker
  const [globalDlTracker, setGlobalDlTracker] = useState<number[]>(Array.from({ length: 30 }, () => 0));
  const [globalUlTracker, setGlobalUlTracker] = useState<number[]>(Array.from({ length: 30 }, () => 0));

  // Audio effects state
  const [notifications, setNotifications] = useState<{ id: string; msg: string }[]>([]);

  // Ref to always hold the latest customPath for use in event listeners with stale closures
  const customPathRef = useRef(customPath);
  useEffect(() => { customPathRef.current = customPath; }, [customPath]);

  // Function to show real-time temporary toast alerts inside the client UI
  const addToast = (msg: string) => {
    const id = Math.random().toString();
    setNotifications((prev) => [...prev, { id, msg }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  };

  // Battery monitoring connection
  useEffect(() => {
    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);

        // Listen for standard updates
        battery.addEventListener("levelchange", () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
        battery.addEventListener("chargingchange", () => {
          setIsCharging(battery.charging);
        });
      });
    }

    // Capture standard network type if supported
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as any).connection;
      const getConnType = () => {
        if (conn.type === "wifi") {
          setNetworkType("Wi-Fi");
        } else if (conn.type === "cellular" || conn.effectiveType) {
          setNetworkType("Mobile Data");
        }
      };
      getConnType();
      conn.addEventListener("change", getConnType);
    }

    // Deep link handling for magnet: URIs
    const setupDeepLink = async () => {
      // Handle app already open — use ref to always get current save path
      CapacitorApp.addListener('appUrlOpen', (data) => {
        const url = data.url;
        if (url.startsWith('magnet:')) {
          Torrent.addTorrent({ magnetUri: url, path: customPathRef.current })
            .then(() => addToast("Magnet link added from deep link!"))
            .catch(() => addToast("Failed to add torrent from deep link"));
        } else if (url.startsWith('content://') || url.startsWith('file://') || isVideoFile(url)) {
          setShowActiveVideo(url);
          addToast("Opening video preview...");
        }
      });

      // Handle app launch from deep link
      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl) {
        if (launchUrl.url.startsWith('magnet:')) {
          Torrent.addTorrent({ magnetUri: launchUrl.url, path: customPathRef.current })
            .then(() => addToast("Magnet link added!"))
            .catch(() => addToast("Failed to add torrent"));
        } else if (launchUrl.url.startsWith('content://') || launchUrl.url.startsWith('file://') || isVideoFile(launchUrl.url)) {
          setShowActiveVideo(launchUrl.url);
          addToast("Opening video preview...");
        }
      }
    };
    setupDeepLink();

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  // Load real folder contents when picker opens or path changes
  useEffect(() => {
    if (!showFolderPicker) return;
    let cancelled = false;
    setPickerLoading(true);
    FileExplorer.listFolder({ path: currentPickerPath })
      .then(({ folders }) => {
        if (!cancelled) {
          setPickerFolders(folders.sort((a, b) => a.name.localeCompare(b.name)));
        }
      })
      .catch(() => {
        if (!cancelled) setPickerFolders([]);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => { cancelled = true; };
  }, [showFolderPicker, currentPickerPath]);

  // Central Native Sync Engine looping every second
  useEffect(() => {
    const syncTimer = setInterval(async () => {
      try {
        const { torrents: nativeTorrents } = await Torrent.getStats();

        setTorrents((prevTorrents) => {
          return nativeTorrents.map((nt: any) => {
            const existing = prevTorrents.find(t => t.infoHash === nt.infoHash);

            // Map native status to our UI status
            let uiStatus: TorrentItem["status"] = "downloading";
            if (nt.status === "finished" || nt.status === "seeding") uiStatus = "seeding";
            if (nt.status === "paused") uiStatus = "paused";
            if (nt.status === "checking") uiStatus = "checking";
            if (nt.status === "error") uiStatus = "error";

            const history = existing ? [...existing.speedHistory.slice(1), { dl: nt.downloadSpeed, ul: nt.uploadSpeed }] :
                            Array.from({ length: 25 }, () => ({ dl: 0, ul: 0 }));

            return {
              id: existing?.id || `tor_${nt.infoHash}`,
              name: nt.name || existing?.name || "Fetching metadata...",
              status: uiStatus,
              infoHash: nt.infoHash,
              addedDate: existing?.addedDate || new Date().toLocaleString(),
              downloadSpeed: nt.downloadSpeed,
              uploadSpeed: nt.uploadSpeed,
              downloaded: nt.downloaded,
              uploaded: existing?.uploaded || 0, // native might not track lifetime upload easily here
              totalSize: nt.totalSize,
              progress: Math.round(nt.progress * 10) / 10,
              peersActive: nt.peersActive,
              peersTotal: existing?.peersTotal || 0,
              seedsActive: nt.seedsActive,
              seedsTotal: existing?.seedsTotal || 0,
              ratio: existing?.ratio || 0,
              magnetURI: existing?.magnetURI || "",
              category: existing?.category || "other",
              savePath: nt.savePath || existing?.savePath || customPathRef.current,
              files: nt.files?.length > 0
                ? nt.files.map((nf: any) => {
                    const existing_file = existing?.files.find((f) => f.name === nf.name);
                    return {
                      name: nf.name,
                      size: nf.size,
                      downloaded: nf.downloaded,
                      fileIndex: nf.index ?? 0,
                      priority: existing_file?.priority ?? "normal",
                    };
                  })
                : existing?.files || [],
              peersList: existing?.peersList || [],
              speedHistory: history,
              eta: nt.downloadSpeed > 0 ? (nt.totalSize - nt.downloaded) / nt.downloadSpeed : 0
            };
          });
        });
      } catch (e) {
        console.error("Failed to sync with native torrent engine", e);
      }
    }, 1000);

    return () => clearInterval(syncTimer);
  }, []);

  // Aggregate aggregate connection metrics
  const globalDownloadSpeed = torrents.reduce((sum, t) => sum + t.downloadSpeed, 0);
  const globalUploadSpeed = torrents.reduce((sum, t) => sum + t.uploadSpeed, 0);

  // Filter criteria selectors
  const filteredTorrents = torrents.filter((tor) => {
    // Label filtering
    if (activeFilter === "downloading" && tor.status !== "downloading") return false;
    if (activeFilter === "completed" && tor.status !== "completed" && tor.status !== "seeding") return false;
    if (activeFilter === "paused" && tor.status !== "paused") return false;

    // Search query matching
    if (searchQuery) {
      return tor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             tor.infoHash.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const selectedTorrent = torrents.find((t) => t.id === selectedTorrentId) || null;

  const VIDEO_EXTS = new Set(["mp4", "mkv", "avi", "mov", "webm", "m4v", "mpg", "mpeg", "ts", "wmv", "flv"]);
  const isVideoFile = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return VIDEO_EXTS.has(ext);
  };

  // Formatting utilities for clean data sizes
  const formatBytes = (bytes: number, decimals: number = 1): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatETA = (seconds: number): string => {
    if (seconds === Infinity || isNaN(seconds) || seconds <= 0) return "--";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hrs = Math.floor(mins / 60);
    const rm = mins % 60;
    return `${hrs}h ${rm}m`;
  };

  const processMagnetUri = async (uri: string) => {
    try {
      await Torrent.addTorrent({ magnetUri: uri, path: customPath });
      addToast("Successfully added torrent link!");
    } catch (e) {
      console.error(e);
      addToast("Failed to add torrent");
    }
  };

  // Ingest torrent magnet links
  const handleAddTorrentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!magnetInput.trim()) {
      addToast("Please input a valid torrent magnet link.");
      return;
    }

    processMagnetUri(magnetInput);
    setMagnetInput("");
    setShowAddDrawer(false);
  };

  // Toggle play-pause states
  const toggleTorrentState = async (id: string) => {
    const tor = torrents.find(t => t.id === id);
    if (!tor) return;

    try {
      if (tor.status === "paused") {
        await Torrent.resumeTorrent({ infoHash: tor.infoHash });
        addToast(`Resuming "${tor.name}"`);
      } else {
        await Torrent.pauseTorrent({ infoHash: tor.infoHash });
        addToast(`Paused "${tor.name}"`);
      }
    } catch (e) {
      addToast("Failed to toggle torrent state");
    }
  };

  // Delete specific torrent with dialog callback
  const deleteTorrent = async (id: string, removeCachedFiles: boolean) => {
    const tor = torrents.find(t => t.id === id);
    if (!tor) return;

    try {
      await Torrent.removeTorrent({ infoHash: tor.infoHash, withFiles: removeCachedFiles });
      setTorrents((prev) => prev.filter((t) => t.id !== id));
      if (selectedTorrentId === id) setSelectedTorrentId(null);
      addToast(removeCachedFiles ? "Torrent and files deleted." : "Torrent removed from list.");
    } catch (e) {
      addToast("Failed to remove torrent");
    }
  };

  // Control individual nested file priorities in selection panel
  const handleFilePriorityChange = (torId: string, file: TorrentFile, targetPriority: "high" | "normal" | "low" | "skip") => {
    setTorrents((prev) =>
      prev.map((tor) => {
        if (tor.id !== torId) return tor;
        const nextFiles = tor.files.map((f) => {
          if (f.name !== file.name) return f;
          const adjustedDownload = targetPriority === "skip" ? 0 : f.downloaded;
          return { ...f, priority: targetPriority, downloaded: adjustedDownload };
        });
        return { ...tor, files: nextFiles };
      })
    );
    // Sync priority to native torrent engine
    const tor = torrents.find(t => t.id === torId);
    if (tor) {
      Torrent.setFilePriority({ infoHash: tor.infoHash, fileIndex: file.fileIndex, priority: targetPriority })
        .catch(() => addToast("Failed to update file priority"));
    }
    addToast(`Set "${file.name}" priority to ${targetPriority.toUpperCase()}`);
  };

  return (
    <div id="OpenTorrent_Root" className="min-h-screen bg-[#070a13] text-gray-100 flex flex-col font-sans relative antialiased max-w-md mx-auto md:max-w-none md:grid md:grid-cols-12 md:h-screen md:overflow-hidden select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      
      {/* Toast notifications overlays */}
      <div id="toast-wrapper" className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="bg-gray-900 border-l-4 border-emerald-500 text-gray-100 text-xs px-4 py-3 rounded-md shadow-xl flex items-center gap-3 animate-slide-in pointer-events-auto"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{n.msg}</span>
          </div>
        ))}
      </div>

      {/* Main interactive screen (Vast Left Area for layout, responsive list) */}
      <div id="main-client" className="flex flex-col h-full md:col-span-7 lg:col-span-8 md:border-r border-gray-800 md:bg-[#070a13]">
        
        {/* Global Toolbar Header */}
        <header id="client-hdr" className="bg-[#090d16] border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-white font-extrabold text-lg select-none">µ</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">OpenTorrent</h1>
              <p className="text-[10px] text-gray-400 font-medium">BTT Protocol ©Niroj</p>
            </div>
          </div>

          {/* Combined Download/Upload speed stats */}
          <div className="hidden sm:flex items-center gap-4 bg-gray-950/60 px-3 py-1.5 rounded-md border border-gray-800 text-[11px] font-mono select-none">
            <div className="flex items-center gap-1">
              <Download className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
              <span className="text-gray-400">DL:</span>
              <span className="text-emerald-400 font-bold">{formatBytes(globalDownloadSpeed)}/s</span>
            </div>
            <div className="w-[1px] h-3 bg-gray-800"></div>
            <div className="flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-gray-400">UL:</span>
              <span className="text-blue-400 font-bold">{formatBytes(globalUploadSpeed)}/s</span>
            </div>
          </div>

          {/* Interactive Tools */}
          <div className="flex items-center gap-2">
            <button
              id="btn-add-torrent"
              onClick={() => setShowAddDrawer(true)}
              className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-800/50 rounded-full transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              id="btn-settings-toggle"
              onClick={() => setShowSettingsDrawer(true)}
              className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-800/50 rounded-full transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Global Stats bar for smaller screens */}
        <div className="sm:hidden bg-gray-950/50 px-4 py-2 flex items-center justify-between border-b border-gray-900 text-[11px] font-mono shrink-0">
          <div className="flex items-center gap-1.5">
            <Download className="w-3 h-3 text-emerald-400" />
            <span className="text-gray-400">DL:</span>
            <span className="text-emerald-400 font-bold">{formatBytes(globalDownloadSpeed)}/s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Upload className="w-3 h-3 text-blue-400" />
            <span className="text-gray-400">UL:</span>
            <span className="text-blue-400 font-bold">{formatBytes(globalUploadSpeed)}/s</span>
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div id="filter-chips" className="bg-[#090d16] px-4 py-2.5 flex items-center justify-between gap-2 border-b border-gray-900 shrink-0 shadow-sm overflow-x-auto whitespace-nowrap scrollbar-hide">
          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: "All" },
              { id: "downloading", label: "Downloading" },
              { id: "completed", label: "Finished" },
              { id: "paused", label: "Paused" }
            ].map((tab) => {
              const active = activeFilter === tab.id;
              // Quantify count
              let count = torrents.length;
              if (tab.id === "downloading") count = torrents.filter((t) => t.status === "downloading").length;
              if (tab.id === "completed") count = torrents.filter((t) => t.status === "completed" || t.status === "seeding").length;
              if (tab.id === "paused") count = torrents.filter((t) => t.status === "paused").length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                    active
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-gray-900/60 text-gray-400 border border-transparent hover:text-gray-200"
                  }`}
                >
                  {tab.label} <span className="opacity-60 text-[10px] ml-0.5">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-36 sm:w-44 ml-2">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search hashes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-md py-1 px-2 pl-8 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-600 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-2 text-gray-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Warning messages for battery savers */}
        {batterySaveMode && batteryLevel <= 20 && !isCharging && (
          <div className="bg-rose-950/40 border-b border-rose-900/40 px-4 py-2 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
            <span>Battery below 20%! Downloading suspended to save energy. Plug in device to resume.</span>
          </div>
        )}

        {wifiOnly && networkType === "Mobile Data" && (
          <div className="bg-[#1e1a0b] border-b border-[#cca31c]/20 px-4 py-2 flex items-center gap-2.5 text-xs text-[#ebd88d]">
            <Wifi className="w-4 h-4 text-[#e2b926] shrink-0 animate-pulse" />
            <span>Wi-Fi Connection unavailable! Mobile network paused per client data settings.</span>
          </div>
        )}

        {/* Active Torrent Lists Content */}
        <div id="torrent-list-box" className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ minHeight: "180px" }}>
          {filteredTorrents.length === 0 ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-transparent to-gray-950/20 rounded-3xl border border-dashed border-gray-800/40 m-2">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full"></div>
                <div className="relative w-20 h-20 rounded-3xl bg-gray-900 flex items-center justify-center border border-gray-800 shadow-2xl">
                  <DownloadCloud className="w-10 h-10 text-gray-600 animate-pulse" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center border-4 border-[#070a13]">
                  <Plus className="w-4 h-4 text-gray-950 stroke-[3]" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-200">Ready to Download?</h3>
              <p className="text-xs text-gray-500 max-w-[240px] mt-2 leading-relaxed">
                {searchQuery
                  ? "We couldn't find any matches for that search. Try another hash or filename."
                  : "Your download queue is empty. Paste a magnet link or use the AI Assistant to discover content."}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddDrawer(true)}
                  className="mt-8 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold text-sm rounded-2xl transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 group"
                >
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                  Add Your First Torrent
                </button>
              )}
            </div>
          ) : (
            filteredTorrents.map((tor) => {
              const matchesSelected = selectedTorrentId === tor.id;
              const percent = tor.progress;
              
              return (
                <div
                  key={tor.id}
                  onClick={() => setSelectedTorrentId(matchesSelected ? null : tor.id)}
                  className={`border rounded-xl transition-all duration-300 overflow-hidden cursor-pointer ${
                    matchesSelected
                      ? "bg-gray-900/40 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                      : "bg-[#0b0f1b] border-gray-800/80 hover:border-gray-700/80"
                  }`}
                >
                  {/* Torrent card upper row */}
                  <div className="p-3.5 flex items-start gap-4 relative">
                    
                    {/* Torrent status icon — tap to pause/resume */}
                    <div className="mt-1 shrink-0">
                      {(tor.status === "downloading" || tor.status === "paused") ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTorrentState(tor.id); }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-90 ${
                            tor.status === "paused"
                              ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-gray-800/60 border-gray-700/40 hover:bg-gray-700/60"
                          }`}
                          title={tor.status === "paused" ? "Resume" : "Pause"}
                        >
                          {tor.status === "paused"
                            ? <Play className="w-4 h-4 text-emerald-400 fill-current" />
                            : <Pause className="w-4 h-4 text-gray-300" />
                          }
                        </button>
                      ) : tor.status === "seeding" ? (
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                          <Upload className="w-5 h-5 text-blue-400" />
                        </div>
                      ) : tor.status === "completed" ? (
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                      ) : null}
                    </div>

                    {/* Meta stats data */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-100 truncate leading-snug">{tor.name}</h4>
                        {tor.category === "media" && <Play className="w-3 h-3 text-emerald-500 shrink-0" />}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-gray-400 font-medium select-none">
                        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 opacity-60" /> {formatBytes(tor.totalSize)}</span>
                        <span className="text-gray-700">|</span>
                        <span className={`${percent === 100 ? "text-emerald-400" : "text-gray-300"} font-bold`}>{percent}%</span>
                        {tor.status === "downloading" && (
                          <>
                            <span className="text-gray-700">|</span>
                            <span className="text-orange-400 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {formatETA(tor.eta || 0)}</span>
                          </>
                        )}
                      </div>

                      {/* Micro speeds view */}
                      {(tor.status === "downloading" || tor.status === "seeding") && (
                        <div className="flex gap-4 mt-2.5 text-[11px] items-center text-gray-400 font-mono select-none">
                          {tor.downloadSpeed > 0 && (
                            <span className="flex items-center gap-1 text-emerald-400 font-bold">
                              <ChevronDown className="w-3.5 h-3.5 animate-pulse" /> {formatBytes(tor.downloadSpeed)}/s
                            </span>
                          )}
                          {tor.uploadSpeed > 0 && (
                            <span className="flex items-center gap-1 text-blue-400 font-bold">
                              <ChevronUp className="w-3.5 h-3.5" /> {formatBytes(tor.uploadSpeed)}/s
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 flex items-center gap-1 bg-gray-900/50 px-1.5 py-0.5 rounded">
                            <Wifi className="w-2.5 h-2.5" /> {tor.peersActive}/{tor.peersTotal}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                         onClick={async () => {
                           const folderPath = tor.savePath || customPath;
                           try {
                             await FileExplorer.openFolder({ path: folderPath });
                           } catch (err) {
                             addToast("Could not open folder");
                           }
                         }}
                          className="p-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded-lg border border-gray-700 transition-all"
                          title="Open Folder"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>

                        {(tor.status === "seeding" || tor.status === "completed") && tor.playableUrl && (
                          <button
                            onClick={() => {
                              setShowActiveVideo(tor.playableUrl || "");
                              addToast(`Now streaming completed torrent video on Pixel player`);
                            }}
                            className="p-1 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-[#070a13] rounded-md text-[10px] font-bold transition-all flex items-center gap-1"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Play
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setDeleteWithFiles(false);
                            setShowDeleteDialog({ id: tor.id, name: tor.name });
                          }}
                          className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                  </div>

                  {/* Standard Android Torrent bar progress */}
                  <div className="px-3.5 pb-3.5 select-none">
                    <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-900/50 p-[1px]">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.3)] ${
                          tor.status === "paused"
                            ? "bg-gray-600 shadow-none"
                            : tor.status === "seeding"
                            ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                            : "bg-gradient-to-r from-emerald-600 to-emerald-400"
                        }`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>


      </div>

      {/* Dynamic Right Area: Torrent Accordion Panel and details screen */}
      <div id="torrent-details-sidebar" className="bg-[#05070e] flex flex-col md:col-span-5 lg:col-span-4 h-full md:overflow-y-auto">
        <div className="p-4 border-b border-gray-900 shrink-0 select-none">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Transfer Monitor details
          </h2>
        </div>

        {selectedTorrent ? (
          <div className="flex-1 flex flex-col min-h-0 bg-transparent">
            {/* Header of selected bundle */}
            <div className="p-4 bg-gray-950/40 border-b border-gray-900/40 shrink-0">
              <span className="text-[9px] uppercase tracking-widest font-extrabold text-emerald-500 font-mono">
                {selectedTorrent.category} pack
              </span>
              <h3 className="text-sm font-bold text-gray-100 leading-snug mt-0.5">{selectedTorrent.name}</h3>
              <p className="text-[10px] text-gray-400 font-mono select-all mt-1 truncate">{selectedTorrent.infoHash}</p>
            </div>

            {/* Tab Swappers */}
            <div className="bg-[#080d15] px-1 flex border-b border-gray-900 shrink-0 overflow-x-auto text-xs font-medium scrollbar-hide select-none">
              {[
                { id: "files", label: "Files", icon: FileText },
                { id: "peers", label: "Peers", icon: Wifi },
                { id: "traffic", label: "Speeds", icon: Activity },
                { id: "info", label: "Metadata", icon: Info }
              ].map((tab) => {
                const TabIcon = tab.icon;
                const matches = activeDetailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDetailTab(tab.id as any)}
                    className={`flex-1 py-3 px-1.5 flex items-center justify-center gap-1.5 border-b-2 font-bold whitespace-nowrap transition-all ${
                      matches
                        ? "border-emerald-500 text-emerald-400 bg-gray-900/20"
                        : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected tab content holder */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* FILES TAB */}
              {activeDetailTab === "files" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px] text-gray-400 select-none pb-1">
                    <span>File Name</span>
                    <span>Priority / Progress</span>
                  </div>
                  <div className="space-y-2">
                    {selectedTorrent.files.map((file) => {
                      const fileCompletePercent = Math.min(100, Math.round((file.downloaded / file.size) * 100));
                      return (
                        <div key={file.name} className="bg-[#090e18] p-2.5 rounded-lg border border-gray-900 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-300 truncate leading-snug">{file.name}</p>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                {formatBytes(file.downloaded)} of {formatBytes(file.size)} &middot; {fileCompletePercent}%
                              </p>
                            </div>
                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              file.downloaded >= file.size
                                ? "bg-emerald-500/20 text-emerald-400"
                                : file.priority === "high"
                                ? "bg-amber-500/10 text-amber-400" 
                                : file.priority === "skip" 
                                ? "bg-rose-500/10 text-rose-400" 
                                : "bg-gray-800 text-gray-400"
                            }`}>
                              {file.downloaded >= file.size ? "Finished" : file.priority}
                            </span>
                          </div>

                          {/* File priority selection checkboxes and progress slide */}
                          <div className="h-1.5 w-full bg-gray-950 rounded-full overflow-hidden select-none border border-gray-900/50">
                            <div
                              className={`h-full transition-all duration-1000 ${
                                file.priority === "skip" ? "bg-gray-800" : "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.3)]"
                              }`}
                              style={{ width: `${fileCompletePercent}%` }}
                            ></div>
                          </div>

                          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-900/60">
                            <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-mono overflow-x-auto whitespace-nowrap scrollbar-hide">
                              <span className="text-gray-500">PRIORITY:</span>
                              {[
                                { label: "High", val: "high" },
                                { label: "Normal", val: "normal" },
                                { label: "Low", val: "low" },
                              ].map((opt) => (
                                <button
                                  key={opt.val}
                                  onClick={() => handleFilePriorityChange(selectedTorrent.id, file, opt.val as any)}
                                  className={`px-2 py-0.5 rounded transition-all ${
                                    file.priority === opt.val
                                      ? "bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20"
                                      : "hover:text-gray-200"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Per-file pause/play toggle */}
                              <button
                                onClick={() => handleFilePriorityChange(
                                  selectedTorrent.id, file,
                                  file.priority === "skip" ? "normal" : "skip"
                                )}
                                className={`p-1.5 rounded-md transition-all active:scale-90 border ${
                                  file.priority === "skip"
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
                                }`}
                                title={file.priority === "skip" ? "Resume file" : "Pause file"}
                              >
                                {file.priority === "skip"
                                  ? <Play className="w-3 h-3 fill-current" />
                                  : <Pause className="w-3 h-3" />
                                }
                              </button>

                            {/* Video preview — now available for partial files too */}
                            {isVideoFile(file.name) && (
                              <button
                                onClick={async () => {
                                  const filePath = `${selectedTorrent.savePath}/${file.path || file.name}`;
                                  try {
                                    if (file.downloaded < file.size) {
                                      await Torrent.setSequentialDownload({
                                        infoHash: selectedTorrent.infoHash,
                                        sequential: true
                                      });
                                      addToast("Enabled sequential download for preview");
                                    }
                                    setShowActiveVideo(filePath);
                                  } catch (e) {
                                    addToast("Could not open media player");
                                  }
                                }}
                                className={`p-1.5 rounded-md transition-all active:scale-90 border ${
                                  file.downloaded >= file.size
                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                                    : "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                                }`}
                                title={file.downloaded >= file.size ? "Play video" : "Preview video (Sequential)"}
                              >
                                <Play className={`w-3 h-3 fill-current ${file.downloaded < file.size ? "animate-pulse" : ""}`} />
                              </button>
                            )}

                            <button
                              onClick={async () => {
                                try {
                                  await FileExplorer.openFolder({ path: selectedTorrent.savePath || customPath });
                                  addToast(`Opening location: ${file.name}`);
                                } catch (e) {
                                  addToast("Could not open file explorer");
                                }
                              }}
                              className={`p-1.5 rounded-md transition-all active:scale-90 ${
                                file.downloaded >= file.size
                                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-gray-950"
                                  : "bg-gray-800 text-gray-500 hover:text-gray-300"
                              }`}
                            >
                              <FolderOpen className="w-3 h-3" />
                            </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PEERS TAB */}
              {activeDetailTab === "peers" && (
                <div className="space-y-3">
                  <div className="flex justify-between text-[11px] text-gray-400 select-none pb-1 font-mono">
                    <span>Peer Client Node</span>
                    <span>Speeds</span>
                  </div>
                  <div className="space-y-2">
                    {selectedTorrent.peersList.map((peer, i) => (
                      <div key={i} className="bg-[#090e18] px-3 py-2.5 rounded-lg border border-gray-900 flex justify-between items-center text-xs font-mono">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1 bg-emerald-950 text-emerald-400 font-bold rounded">
                              {peer.countryCode}
                            </span>
                            <span className="text-xs font-bold text-gray-300 truncate">{peer.ip}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">{peer.client}</p>
                        </div>
                        <div className="text-right text-[10px]">
                          {peer.dlSpeed > 0 && <p className="text-emerald-400 font-semibold">↓ {formatBytes(peer.dlSpeed)}/s</p>}
                          {peer.ulSpeed > 0 && <p className="text-blue-400">↑ {formatBytes(peer.ulSpeed)}/s</p>}
                          <p className="text-[9px] text-gray-500 mt-0.5">{peer.progress}% completed</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DYNAMIC SPEEDS GRAPH */}
              {activeDetailTab === "traffic" && (
                <div className="space-y-3 select-none">
                  <div className="flex justify-between items-center bg-gray-950 p-3 rounded-lg border border-gray-900">
                    <div>
                      <p className="text-[10px] text-gray-500 font-mono">Simulated Speed Rate</p>
                      <h4 className="text-sm font-bold text-gray-200 mt-0.5">Live bandwidth stats</h4>
                    </div>
                    <div className="text-right font-mono text-[10px] space-y-0.5">
                      <p className="text-emerald-400 font-semibold">Max DL: {formatBytes(Math.max(...selectedTorrent.speedHistory.map(h => h.dl), 1000000))}/s</p>
                      <p className="text-blue-400">Max UL: {formatBytes(Math.max(...selectedTorrent.speedHistory.map(h => h.ul), 50000))}/s</p>
                    </div>
                  </div>

                  {/* SVG Canvas drawing real line graphs dynamically */}
                  <div className="w-full h-44 bg-[#090e18] border border-gray-900 rounded-xl p-4 flex flex-col relative shadow-inner group">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                         <Activity className="w-3 h-3 text-emerald-500" />
                         Live Network
                       </span>
                       <div className="flex gap-3">
                         <div className="flex items-center gap-1.5">
                           <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                           <span className="text-[9px] font-mono text-emerald-500">DL</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                           <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                           <span className="text-[9px] font-mono text-blue-500">UL</span>
                         </div>
                       </div>
                    </div>

                    <div className="flex-1 relative">
                      <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                        {/* Grid lines */}
                        <line x1="0" y1="10" x2="100" y2="10" stroke="#1f2937" strokeWidth="0.2" strokeDasharray="2,2" />
                        <line x1="0" y1="20" x2="100" y2="20" stroke="#1f2937" strokeWidth="0.2" strokeDasharray="2,2" />
                        <line x1="0" y1="30" x2="100" y2="30" stroke="#1f2937" strokeWidth="0.2" strokeDasharray="2,2" />

                        {/* Download Speeds path line */}
                        {(() => {
                          const maxVal = Math.max(...selectedTorrent.speedHistory.map(h => h.dl), 100000);
                          const points = selectedTorrent.speedHistory.map((h, index) => {
                            const x = (index / (selectedTorrent.speedHistory.length - 1)) * 100;
                            const y = maxVal > 0 ? 40 - (h.dl / maxVal) * 35 : 40;
                            return `${x},${y}`;
                          }).join(" ");

                          return (
                            <>
                              <polyline fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
                              {/* Area fill */}
                              <polygon
                                fill="url(#dlAreaGrad)"
                                opacity="0.15"
                                points={`0,40 ${points} 100,40`}
                              />
                            </>
                          );
                        })()}

                        {/* Upload Speeds path line */}
                        {(() => {
                          const maxVal = Math.max(...selectedTorrent.speedHistory.map(h => h.ul), 10000);
                          const points = selectedTorrent.speedHistory.map((h, index) => {
                            const x = (index / (selectedTorrent.speedHistory.length - 1)) * 100;
                            const y = maxVal > 0 ? 40 - (h.ul / maxVal) * 35 : 40;
                            return `${x},${y}`;
                          }).join(" ");

                          return (
                            <>
                              <polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
                              <polygon
                                fill="url(#ulAreaGrad)"
                                opacity="0.08"
                                points={`0,40 ${points} 100,40`}
                              />
                            </>
                          );
                        })()}

                        {/* Defined visual gradients Inside SVG scope */}
                        <defs>
                          <linearGradient id="dlAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="ulAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* TECHNICAL INFO METADATA */}
              {activeDetailTab === "info" && (
                <div className="space-y-2 text-xs">
                  <div className="bg-gray-950 p-3 rounded-lg border border-gray-900 space-y-2.5 font-mono">
                    <div className="flex justify-between py-1 border-b border-gray-900/60">
                      <span className="text-gray-500 text-[10px]">ADDED DATE</span>
                      <span className="text-gray-300 text-[10px] text-right">{selectedTorrent.addedDate}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-900/60">
                      <span className="text-gray-500 text-[10px]">PIECE CONFIG</span>
                      <span className="text-gray-300 text-[10px] text-right">512 files &middot; 4.0 MB blocks</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-900/60">
                      <span className="text-gray-500 text-[10px]">WIFI ONLY TRIGGER</span>
                      <span className="text-emerald-400 text-[10px] text-right">ACTIVE</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500 text-[10px]">SAVE FOLDER</span>
                      <span className="text-gray-300 text-[10px] text-right truncate max-w-[150px]">{customPath}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedTorrent.magnetURI);
                      addToast("Copied Magnet URI code to Pixel clipboard!");
                    }}
                    className="w-full py-2.5 bg-slate-900/80 hover:bg-slate-800 text-gray-300 font-bold rounded-lg border border-gray-800 text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Copy Magnet Link URI
                  </button>
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500 select-none">
            <Info className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-xs">Select any download to monitor progress, control file priorities, view speeds or toggle trackers.</p>
          </div>
        )}
      </div>

      {/* MODAL DRAWERS: settings configuration popup */}
      {showSettingsDrawer && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#090d16] border border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            
            <div className="px-5 py-4 border-b border-gray-900 flex items-center justify-between bg-gray-950/40">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-gray-100">OpenTorrent Client Settings</h3>
              </div>
              <button onClick={() => setShowSettingsDrawer(false)} className="p-1 text-gray-500 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              
              {/* Speed Limits section */}
              <div className="space-y-2.5 pb-3 border-b border-gray-900">
                <h4 className="font-bold text-[10px] tracking-wider uppercase text-emerald-400">Bandwidth Limits</h4>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[11px] text-gray-400">
                    <span>Limit Download Rate:</span>
                    <span className="text-emerald-400 font-bold">{downloadLimit === 0 ? "Unlimited" : `${downloadLimit} KB/s`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10240" // up to 10MB/s
                    step="256"
                    value={downloadLimit}
                    onChange={(e) => setDownloadLimit(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[11px] text-gray-400">
                    <span>Limit Upload Rate:</span>
                    <span className="text-blue-400 font-bold">{uploadLimit === 0 ? "Unlimited" : `${uploadLimit} KB/s`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2048" // up to 2MB/s
                    step="128"
                    value={uploadLimit}
                    onChange={(e) => setUploadLimit(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Power control settings */}
              <div className="space-y-3 pb-3 border-b border-gray-900">
                <h4 className="font-bold text-[10px] tracking-wider uppercase text-emerald-400">Power & Wifi Control</h4>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={wifiOnly}
                    onChange={(e) => setWifiOnly(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-gray-800 text-emerald-500 accent-emerald-500 bg-gray-950 shrink-0"
                  />
                  <div>
                    <p className="font-bold text-gray-200 group-hover:text-white transition-colors">Wi-Fi networks only</p>
                    <p className="text-[10px] text-gray-500">Stop torrenting on cellular data networks</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={batterySaveMode}
                    onChange={(e) => setBatterySaveMode(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-gray-800 text-emerald-500 accent-emerald-500 bg-gray-950 shrink-0"
                  />
                  <div>
                    <p className="font-bold text-gray-200 group-hover:text-white transition-colors">Battery Saving Mode</p>
                    <p className="text-[10px] text-gray-500">Auto-pause downloads when charge falls below 20%</p>
                  </div>
                </label>
              </div>

              {/* Advanced folder destinations */}
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-[10px] tracking-wider uppercase text-emerald-400">Default Target Directory</h4>
                  <button
                    onClick={() => {
                      setCurrentPickerPath("/storage/emulated/0");
                      setShowFolderPicker(true);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md transition-all active:scale-95"
                  >
                    <FolderOpen className="w-3 h-3" />
                    Browse
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-[11px] text-white placeholder-gray-500 font-mono focus:outline-none focus:border-emerald-500 transition-all"
                    />
                    <div className="absolute right-3 top-2.5">
                      <HardDrive className="w-4 h-4 text-gray-700" />
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-500 font-mono pl-1">Target folder on internal device storage</p>
                </div>
              </div>

            </div>

            <div className="p-4 bg-gray-950 border-t border-gray-900 text-center">
              <button
                onClick={() => {
                  setShowSettingsDrawer(false);
                  addToast("Successfully verified client configurations!");
                }}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-extrabold rounded-lg text-xs tracking-wider uppercase shadow-xl shadow-emerald-500/10 active:scale-95 transition-all"
              >
                Save Settings
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DRAWERS: addition prompt popup */}
      {showAddDrawer && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#090d16] border border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            
            <div className="px-5 py-4 border-b border-gray-900 flex items-center justify-between bg-gray-950/40">
              <div className="flex items-center gap-2">
                <Plus className="w-4.5 h-4.5 text-emerald-400" />
                <h3 className="font-bold text-sm text-gray-100">Add Torrent Link</h3>
              </div>
              <button onClick={() => setShowAddDrawer(false)} className="p-1 text-gray-500 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTorrentSubmit} className="flex-1 overflow-y-auto max-h-[75vh]">
              <div className="p-5 space-y-4 text-xs">
                
                {/* Manual placement input */}
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs font-bold text-gray-300">Insert Magnet Link URI or InfoHash:</label>
                  <textarea
                    placeholder="magnet:?xt=urn:btih:..."
                    value={magnetInput}
                    onChange={(e) => {
                      setMagnetInput(e.target.value);
                      setSelectedPreset(null); // break preset lock on manual writing
                    }}
                    className="w-full h-20 bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                <div className="bg-gray-950 p-3 rounded-lg border border-gray-900 flex justify-between items-center text-xs">
                  <div>
                    <h5 className="font-bold text-gray-400 text-[10px]">SAVE FOLDER DESTINATION:</h5>
                    <p className="font-mono text-gray-500 text-[9px] mt-0.5">{customPath}</p>
                  </div>
                  <HardDrive className="w-5 h-5 text-gray-600" />
                </div>

              </div>

              <div className="p-4 bg-gray-950 border-t border-gray-900 text-center flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDrawer(false)}
                  className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-extrabold rounded-lg text-xs shadow-xl shadow-emerald-500/10 transition-all"
                >
                  Start Download
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* FULLSCREEN REAL MP4 MULTIMEDIA VIDEO PLAYER TRIGGER */}
      {showActiveVideo && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col justify-between p-4">
          <div className="flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="text-xs font-bold truncate">Google Pixel Live Player</span>
            </div>
            <button
              onClick={() => setShowActiveVideo(null)}
              className="p-2 text-gray-400 hover:text-white rounded-full bg-gray-900 border border-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2">
            <video
              src={showActiveVideo.startsWith('http') ? showActiveVideo : Capacitor.convertFileSrc(showActiveVideo)}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[75vh] rounded-lg border border-gray-800 shadow-2xl"
            ></video>
          </div>

          <div className="text-center pb-4 text-xs text-gray-400">
            <p>Playing local media cache directly from Pixel virtual memory sandbox.</p>
          </div>
        </div>
      )}

      {/* NATIVE-LIKE FOLDER PICKER MODAL */}
      {showFolderPicker && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0b101b] border border-gray-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            <div className="px-6 py-5 border-b border-gray-900 bg-gray-950/40 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-100 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-emerald-500" />
                  Select Save Location
                </h3>
                <div className="flex items-center gap-1.5 mt-1 overflow-x-auto scrollbar-hide">
                  <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">{currentPickerPath}</span>
                </div>
              </div>
              <button
                onClick={() => setShowFolderPicker(false)}
                className="p-2 text-gray-500 hover:text-white bg-gray-900 rounded-xl transition-colors shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[50vh] p-2 space-y-1">
              {/* Back button if not at root */}
              {currentPickerPath !== "/storage" && (
                <button
                  onClick={() => {
                    const parts = currentPickerPath.split("/");
                    parts.pop();
                    setCurrentPickerPath(parts.join("/"));
                  }}
                  className="w-full p-4 flex items-center gap-4 rounded-2xl hover:bg-gray-900/40 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-950 flex items-center justify-center border border-gray-900">
                    <ChevronDown className="w-5 h-5 text-gray-500 rotate-90" />
                  </div>
                  <p className="text-sm font-bold text-gray-400">.. (Parent Directory)</p>
                </button>
              )}

              {/* Real directory contents from native plugin */}
              {pickerLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-500 text-xs gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : pickerFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-600 text-xs gap-2">
                  <FolderOpen className="w-6 h-6" />
                  No sub-folders found
                </div>
              ) : (
                pickerFolders.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => setCurrentPickerPath(folder.path)}
                    className="w-full p-4 flex items-center justify-between rounded-2xl hover:bg-gray-900/60 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/5 transition-all">
                        <FolderOpen className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-300 group-hover:text-white">{folder.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono truncate max-w-[180px]">{folder.path}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </button>
                ))
              )}
            </div>

            <div className="p-5 bg-gray-950/80 border-t border-gray-900 flex gap-3">
               <button
                onClick={() => setShowFolderPicker(false)}
                className="flex-1 py-3 text-xs font-bold text-gray-400 hover:text-white transition-colors"
               >
                 Cancel
               </button>
               <button
                onClick={() => {
                  setCustomPath(currentPickerPath);
                  setShowFolderPicker(false);
                  addToast(`Location confirmed: ${currentPickerPath}`);
                }}
                className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold rounded-2xl text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
               >
                 Use This Folder
               </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-[#0d1120] border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-900 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <Trash2 className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-100">Remove Torrent</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">This action cannot be undone</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-300 leading-relaxed">
                Are you sure you want to remove{" "}
                <span className="font-bold text-white">"{showDeleteDialog.name}"</span>?
              </p>

              <label className="flex items-start gap-3 cursor-pointer group bg-rose-950/20 border border-rose-900/30 rounded-xl p-3 hover:border-rose-500/30 transition-all">
                <input
                  type="checkbox"
                  checked={deleteWithFiles}
                  onChange={(e) => setDeleteWithFiles(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-rose-500 shrink-0 cursor-pointer"
                />
                <div>
                  <p className="text-xs font-bold text-gray-200 group-hover:text-white transition-colors">
                    Remove downloaded files
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Permanently deletes all files saved to storage
                  </p>
                </div>
              </label>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(null)}
                className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold rounded-xl text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteTorrent(showDeleteDialog.id, deleteWithFiles);
                  setShowDeleteDialog(null);
                }}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
              >
                {deleteWithFiles ? "Delete & Remove Files" : "Remove from List"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
