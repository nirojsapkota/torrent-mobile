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
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { App as CapacitorApp } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";

interface FileExplorerPlugin {
  openFolder(options: { path: string }): Promise<void>;
}

const FileExplorer = registerPlugin<FileExplorerPlugin>("FileExplorer");

// Types definition for our torrent ecosystem
interface TorrentFile {
  name: string;
  size: number;
  downloaded: number;
  priority: "high" | "normal" | "low" | "skip";
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
    const saved = localStorage.getItem("utorrent_history");
    return saved ? JSON.parse(saved) : [];
  });

  // Persist history
  useEffect(() => {
    localStorage.setItem("utorrent_history", JSON.stringify(torrents));
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

  // New torrent creation inputs
  const [magnetInput, setMagnetInput] = useState("");
  const [customPath, setCustomPath] = useState("/storage/emulated/0/Download");

  // Client speed limitation parameters & power optimization
  const [downloadLimit, setDownloadLimit] = useState<number>(0); // 0 means Unlimited
  const [uploadLimit, setUploadLimit] = useState<number>(0); // 0 means Unlimited
  const [wifiOnly, setWifiOnly] = useState<boolean>(false);
  const [batterySaveMode, setBatterySaveMode] = useState<boolean>(true);
  const [disableTimer, setDisableTimer] = useState<boolean>(false);

  // Hardware state capture (Battery percentage & Charging feedback)
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  const [isCharging, setIsCharging] = useState<boolean>(true);
  const [networkType, setNetworkType] = useState<"Wi-Fi" | "Mobile Data">("Wi-Fi");

  // Simulated Speed Graphs continuous tracker
  const [globalDlTracker, setGlobalDlTracker] = useState<number[]>(Array.from({ length: 30 }, () => 0));
  const [globalUlTracker, setGlobalUlTracker] = useState<number[]>(Array.from({ length: 30 }, () => 0));

  // Audio effects state
  const [notifications, setNotifications] = useState<{ id: string; msg: string }[]>([]);

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
      // Handle app already open
      CapacitorApp.addListener('appUrlOpen', (data) => {
        const url = data.url;
        if (url.startsWith('magnet:')) {
          processMagnetUri(url);
        }
      });

      // Handle app launch from deep link
      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl && launchUrl.url.startsWith('magnet:')) {
        processMagnetUri(launchUrl.url);
      }
    };
    setupDeepLink();

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  // Central Physics engine looping every second
  useEffect(() => {
    const microPhysicsTimer = setInterval(() => {
      setTorrents((prevTorrents) => {
        const updated = prevTorrents.map((tor) => {
          if (tor.status !== "downloading" && tor.status !== "seeding") {
            return { ...tor, downloadSpeed: 0, uploadSpeed: tor.status === "paused" ? 0 : tor.uploadSpeed };
          }

          // Check battery rules (if battery saver active and battery < 20% and unplugged)
          if (batterySaveMode && batteryLevel <= 20 && !isCharging && tor.status === "downloading") {
            return { ...tor, status: "paused" as const, downloadSpeed: 0, uploadSpeed: 0 };
          }

          // Check Wifi Only rule
          if (wifiOnly && networkType === "Mobile Data" && tor.status === "downloading") {
            return { ...tor, downloadSpeed: 0, uploadSpeed: 0 };
          }

          if (tor.status === "downloading") {
            // Find total files size excluding priority 'skip'
            const activeFiles = tor.files.filter((f) => f.priority !== "skip");
            const skipSize = tor.files.filter((f) => f.priority === "skip").reduce((sum, f) => sum + f.size, 0);
            const activeTotalSize = tor.totalSize - skipSize;

            // Calculate overall download bytes needed
            const currentActiveDownloaded = tor.files
              .filter((f) => f.priority !== "skip")
              .reduce((sum, f) => sum + f.downloaded, 0);

            // Calculate target speed
            // If download limit set, divide evenly among downloading torrents
            const dlCount = prevTorrents.filter((t) => t.status === "downloading").length || 1;
            const cappedMaxDlSpeed = downloadLimit > 0 ? (downloadLimit * 1000 * 1024) / dlCount : 8 * 1024 * 1024; // normal fast: 8MB/s max

            // Random rate fluctuations (+/- 15%)
            const baseDlSpeed = Math.min(cappedMaxDlSpeed, activeTotalSize / 120);
            const currentSpeedScale = 0.85 + Math.random() * 0.3;
            let finalDlSpeed = Math.round(baseDlSpeed * currentSpeedScale);

            // Prevent speed from showing abnormally fast as it finishes
            const remainingBytes = activeTotalSize - currentActiveDownloaded;
            if (finalDlSpeed > remainingBytes) {
              finalDlSpeed = Math.max(50000, remainingBytes);
            }

            // Simple speed simulation for active uploads
            const ulCount = prevTorrents.filter((t) => t.status === "downloading" || t.status === "seeding").length || 1;
            const cappedMaxUlSpeed = uploadLimit > 0 ? (uploadLimit * 1000 * 1024) / ulCount : 500 * 1024; // 500 KB/s normal
            const finalUlSpeed = Math.round(cappedMaxUlSpeed * (0.7 + Math.random() * 0.4));

            // Tick downloading progression on files
            let bytesDownloadedThisTick = finalDlSpeed;
            const nextFiles = tor.files.map((file) => {
              if (file.priority === "skip" || file.downloaded >= file.size) {
                return file;
              }
              const need = file.size - file.downloaded;
              // Add multiplier if file set to priority High
              const priorityMultiplier = file.priority === "high" ? 2.5 : file.priority === "low" ? 0.4 : 1.0;
              const bytesToAllocate = Math.min(need, Math.round(bytesDownloadedThisTick * priorityMultiplier));
              
              bytesDownloadedThisTick = Math.max(0, bytesDownloadedThisTick - bytesToAllocate);
              return {
                ...file,
                downloaded: file.downloaded + bytesToAllocate
              };
            });

            const freshDownloadedTotal = nextFiles.reduce((sum, f) => sum + f.downloaded, 0);
            const overallCompletedBytes = freshDownloadedTotal;
            const overallProgressValue = Math.min(100, Math.round((overallCompletedBytes / tor.totalSize) * 1000) / 10);

            const isDoneNow = overallCompletedBytes >= tor.totalSize;

            if (isDoneNow) {
              // Torrent complete toast notification
              addToast(`µTorrent: "${tor.name}" finished downloading!`);
              return {
                ...tor,
                status: "completed" as const,
                downloadSpeed: 0,
                uploadSpeed: Math.round(200 * 1024 * (Math.random() * 0.5 + 0.8)),
                downloaded: tor.totalSize,
                progress: 100,
                files: tor.files.map((f) => ({ ...f, downloaded: f.size })),
                speedHistory: [...tor.speedHistory.slice(1), { dl: 0, ul: 60000 }]
              };
            }

            // Smooth append speed tracking
            const nextHistory = [...tor.speedHistory.slice(1), { dl: finalDlSpeed, ul: finalUlSpeed }];

            return {
              ...tor,
              downloadSpeed: finalDlSpeed,
              uploadSpeed: finalUlSpeed,
              downloaded: overallCompletedBytes,
              files: nextFiles,
              progress: overallProgressValue,
              speedHistory: nextHistory,
              eta: finalDlSpeed > 0 ? Math.round(remainingBytes / finalDlSpeed) : 0
            };
          }

          if (tor.status === "seeding") {
            const cappedMaxUlSpeed = uploadLimit > 0 ? (uploadLimit * 1000 * 1024) / prevTorrents.length : 250 * 1024;
            const finalUlSpeed = Math.round(cappedMaxUlSpeed * (0.8 + Math.random() * 0.3));
            const nextHistory = [...tor.speedHistory.slice(1), { dl: 0, ul: finalUlSpeed }];

            return {
              ...tor,
              downloadSpeed: 0,
              uploadSpeed: finalUlSpeed,
              uploaded: tor.uploaded + finalUlSpeed,
              ratio: Math.round(((tor.uploaded + finalUlSpeed) / tor.totalSize) * 100) / 100,
              speedHistory: nextHistory
            };
          }

          return tor;
        });

        // Trigger dynamic global telemetry speeds based on all records combined
        const totalDl = updated.reduce((sum, t) => sum + t.downloadSpeed, 0);
        const totalUl = updated.reduce((sum, t) => sum + t.uploadSpeed, 0);

        setGlobalDlTracker((prev) => [...prev.slice(1), totalDl]);
        setGlobalUlTracker((prev) => [...prev.slice(1), totalUl]);

        return updated;
      });
    }, 1000);

    return () => clearInterval(microPhysicsTimer);
  }, [downloadLimit, uploadLimit, batteryLevel, isCharging, networkType, wifiOnly, batterySaveMode]);

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

  const processMagnetUri = (uri: string) => {
    let name = "Manual Link Transfer Bundle";
    let size = 350000000; // default 350 MB simulated
    let initialFiles: TorrentFile[] = [
      { name: "downloaded_package.zip", size: 349000000, downloaded: 0, priority: "normal" },
      { name: "µTorrent_Manifest.txt", size: 1000000, downloaded: 0, priority: "normal" }
    ];
    let mediaUrl: string | undefined = undefined;
    let targetCat: "media" | "software" | "other" = "other";

    // Check presets first
    const hashMatch = uri.match(/btih:([a-fA-F0-9]{40})/);
    const finalHash = hashMatch ? hashMatch[1].toLowerCase() : null;

    if (finalHash) {
      const presetIdx = PRESET_TORRENTS.findIndex(p => p.hash === finalHash);
      if (presetIdx !== -1) {
        const preset = PRESET_TORRENTS[presetIdx];
        name = preset.name;
        size = preset.size;
        mediaUrl = preset.playableUrl;
        targetCat = preset.category;
        initialFiles = preset.files.map((file) => ({
          name: file.name,
          size: file.size,
          downloaded: 0,
          priority: "normal"
        }));
      } else {
        const dnMatch = uri.match(/[?&]dn=([^&]+)/);
        if (dnMatch) {
          name = decodeURIComponent(dnMatch[1]).replace(/\+/g, " ");
        }
      }
    }

    const infoHash = finalHash || Math.random().toString(16).substring(2, 42);

    if (torrents.some((t) => t.infoHash === infoHash)) {
      addToast("Torrent already in roster!");
      return;
    }

    const customTorrent: TorrentItem = {
      id: `tor_${Date.now()}`,
      name,
      status: "downloading",
      infoHash,
      addedDate: new Date().toLocaleString(),
      downloadSpeed: 1000000,
      uploadSpeed: 25000,
      downloaded: 0,
      uploaded: 0,
      totalSize: size,
      peersActive: Math.round(15 + Math.random() * 20),
      peersTotal: Math.round(40 + Math.random() * 100),
      seedsActive: Math.round(5 + Math.random() * 15),
      seedsTotal: Math.round(100 + Math.random() * 300),
      ratio: 0,
      magnetURI: uri,
      category: targetCat,
      playableUrl: mediaUrl,
      files: initialFiles,
      peersList: [
        { ip: "64.233.160.10", client: "Google WebPeer/1.0", dlSpeed: 150000, ulSpeed: 5000, progress: 5, country: "United States", countryCode: "US" },
        { ip: "213.180.193.3", client: "Yandex Peer/4.2", dlSpeed: 340000, ulSpeed: 9000, progress: 3, country: "Russia", countryCode: "RU" },
        { ip: "202.96.128.86", client: "ChinaNet Peer/5.0", dlSpeed: 220000, ulSpeed: 8000, progress: 14, country: "China", countryCode: "CN" }
      ],
      speedHistory: Array.from({ length: 25 }, () => ({ dl: 0, ul: 0 }))
    };

    setTorrents((prev) => [customTorrent, ...prev]);
    setSelectedTorrentId(customTorrent.id);
    addToast(`Started download: ${name.substring(0, 20)}...`);
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
  const toggleTorrentState = (id: string) => {
    setTorrents((prev) =>
      prev.map((tor) => {
        if (tor.id !== id) return tor;
        if (tor.status === "paused") {
          addToast(`Resuming "${tor.name}" active links`);
          return { ...tor, status: tor.downloaded >= tor.totalSize ? "seeding" : "downloading" };
        } else {
          addToast(`Paused "${tor.name}" download queue`);
          return { ...tor, status: "paused", downloadSpeed: 0, uploadSpeed: 0 };
        }
      })
    );
  };

  // Delete specific torrent with dialog callback
  const deleteTorrent = (id: string, removeCachedFiles: boolean) => {
    setTorrents((prev) => prev.filter((t) => t.id !== id));
    if (selectedTorrentId === id) {
      setSelectedTorrentId(null);
    }
    addToast(removeCachedFiles ? "Torrent record and downloaded blocks deleted." : "Torrent entry removed.");
  };

  // Control individual nested file priorities in selection panel
  const handleFilePriorityChange = (torId: string, fileName: string, targetPriority: "high" | "normal" | "low" | "skip") => {
    setTorrents((prev) =>
      prev.map((tor) => {
        if (tor.id !== torId) return tor;
        const nextFiles = tor.files.map((file) => {
          if (file.name !== fileName) return file;
          // If we skip the file, we zero it out to update overall progress bar quickly
          const adjustedDownload = targetPriority === "skip" ? 0 : file.downloaded;
          return { ...file, priority: targetPriority, downloaded: adjustedDownload };
        });
        return { ...tor, files: nextFiles };
      })
    );
    addToast(`Set "${fileName}" priority level to ${targetPriority.toUpperCase()}`);
  };

  return (
    <div id="uTorrent_Root" className="min-h-screen bg-[#070a13] text-gray-100 flex flex-col font-sans relative antialiased max-w-md mx-auto md:max-w-none md:grid md:grid-cols-12 md:h-screen md:overflow-hidden select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      
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
              <h1 className="text-base font-bold text-white tracking-wide">µTorrent</h1>
              <p className="text-[10px] text-gray-400 font-medium">BTT Protocol Mobile 4.2</p>
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
                    
                    {/* Torrent status identifier */}
                    <div className="mt-1 shrink-0">
                      {tor.status === "downloading" && (
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                          <Download className="w-5 h-5 text-emerald-400 animate-bounce" />
                        </div>
                      )}
                      {tor.status === "seeding" && (
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                          <Upload className="w-5 h-5 text-blue-400" />
                        </div>
                      )}
                      {tor.status === "completed" && (
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                      )}
                      {tor.status === "paused" && (
                        <div className="w-9 h-9 rounded-xl bg-gray-800/50 flex items-center justify-center border border-gray-700/30">
                          <Pause className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
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

                    {/* Audio streaming & multimedia direct playing capabilities */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      
                      {/* Action buttons */}
                      <div className="flex gap-1">
                        <button
                          onClick={async () => {
                            const path = `${customPath}/${tor.name}`;
                            try {
                              await FileExplorer.openFolder({ path });
                              addToast(`Opening: ${tor.name}`);
                            } catch (err) {
                              addToast("Open failed - jumping to parent");
                              await FileExplorer.openFolder({ path: customPath });
                            }
                          }}
                          className="p-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded-lg border border-gray-700 transition-all"
                          title="Open Folder"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>

                        {tor.status === "seeding" || tor.status === "completed" ? (
                          tor.playableUrl ? (
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
                          ) : (
                            <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold uppercase rounded text-emerald-400">
                              Done
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => toggleTorrentState(tor.id)}
                            className={`p-1.5 rounded-lg hover:bg-gray-800 border transition-all ${
                              tor.status === "paused"
                                ? "border-emerald-500/20 text-emerald-400"
                                : "border-gray-800 text-gray-400"
                            }`}
                          >
                            {tor.status === "paused" ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          if (confirm(`Do you wish to delete "${tor.name}" from active transfers list?`)) {
                            deleteTorrent(tor.id, true);
                          }
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

        {/* Floating Action Addition FAB (Optimized Android layout) */}
        <div className="fixed bottom-6 right-6 md:absolute md:bottom-8 md:right-8 z-40 select-none">
          <button
            id="fab-add-torrent"
            onClick={() => setShowAddDrawer(true)}
            className="w-14 h-14 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-gray-950 rounded-2xl flex items-center justify-center shadow-[0_8px_25px_-5px_rgba(16,185,129,0.5)] active:scale-90 transition-all group"
          >
            <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform stroke-[3]" />
          </button>
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
                              <span className="text-gray-500">SET RATE:</span>
                              {[
                                { label: "High", val: "high" },
                                { label: "Normal", val: "normal" },
                                { label: "Low", val: "low" },
                                { label: "Don't DL", val: "skip" }
                              ].map((opt) => (
                                <button
                                  key={opt.val}
                                  onClick={() => handleFilePriorityChange(selectedTorrent.id, file.name, opt.val as any)}
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

                            <button
                              onClick={async () => {
                                try {
                                  await FileExplorer.openFolder({ path: customPath });
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
                <h3 className="font-bold text-sm text-gray-100">µTorrent Client Settings</h3>
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
                    onClick={() => setShowFolderPicker(true)}
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
              src={showActiveVideo}
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

              {/* Simulated directory contents based on depth */}
              {(() => {
                if (currentPickerPath === "/storage") {
                  return [
                    { name: "emulated", icon: HardDrive, label: "Internal Storage" },
                    { name: "sdcard1", icon: FolderOpen, label: "SD Card (External)" },
                    { name: "usb_storage", icon: Settings, label: "USB Drive" },
                  ];
                }
                if (currentPickerPath === "/storage/emulated") {
                  return [
                    { name: "0", icon: FolderOpen, label: "User 0 (Primary)" },
                  ];
                }
                if (currentPickerPath === "/storage/emulated/0" || currentPickerPath === "/storage/sdcard1") {
                  return [
                    { name: "Download", icon: DownloadCloud },
                    { name: "Movies", icon: Play },
                    { name: "Music", icon: Volume2 },
                    { name: "Pictures", icon: Sparkles },
                    { name: "Documents", icon: FileText },
                    { name: "Torrents", icon: HardDrive },
                    { name: "Android", icon: Settings },
                  ];
                }
                return [
                  { name: "Completed", icon: CheckCircle },
                  { name: "In Progress", icon: Activity },
                  { name: "Backups", icon: ShieldCheck },
                  { name: "Media Cache", icon: FolderOpen },
                ];
              })().map((folder) => (
                <button
                  key={folder.name}
                  onClick={() => {
                    setCurrentPickerPath(`${currentPickerPath}/${folder.name}`);
                  }}
                  className="w-full p-4 flex items-center justify-between rounded-2xl hover:bg-gray-900/60 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/5 transition-all">
                      <folder.icon className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-300 group-hover:text-white">{(folder as any).label || folder.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{currentPickerPath}/{folder.name}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-700 -rotate-90" />
                </button>
              ))}
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

    </div>
  );
}
