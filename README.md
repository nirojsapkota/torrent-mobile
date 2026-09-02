# OpenTorrent Mobile

OpenTorrent is a high-performance, open-source BitTorrent client for Android, built with React, Capacitor, and the powerful libtorrent native engine.

## 🚀 Features

### 🎬 Media Streaming & Preview
*   **Sequential Downloading**: Priority downloading for media files allows you to start watching videos before the download is complete.
*   **Integrated Player**: Built-in video player supporting common formats (MP4, MKV, AVI, etc.) using native file access.
*   **External Intent Support**: Open video files directly from your device's file manager into OpenTorrent.

### 🔋 Smart Power & Data Management
*   **Battery Saving Mode**: Automatically pauses all active downloads when battery drops below 20% to preserve your device's life (auto-resumes when plugged in).
*   **Wi-Fi Only Mode**: Native enforcement to prevent accidental data overages on cellular networks.
*   **Foreground Service**: Persistent downloading with a notification-based background service to prevent the OS from killing the process.

### 📊 Advanced Torrent Management
*   **Real-time Monitoring**: Live speed graphs for both download and upload traffic.
*   **File Priority**: Control individual file priorities (High, Normal, Low, or Skip) within a torrent bundle.
*   **Deep Link Integration**: Instantly catch `magnet:` links and `.torrent` files from browsers or other apps.
*   **Storage Browser**: Integrated folder picker to select custom download locations on your device.

## 🛠 Tech Stack

*   **Frontend**: React + Tailwind CSS
*   **Icons**: Lucide React
*   **Mobile Bridge**: Capacitor
*   **Native Engine**: Java + [libtorrent4j](https://github.com/aldenml/libtorrent4j) (wrapping libtorrent C++)
*   **Build System**: Gradle + NPM

## 🏗 Setup & Build

### Prerequisites
*   Node.js (v18+)
*   Android Studio + SDK
*   JDK 17+

### Steps
1.  **Clone and Install**:
    ```bash
    npm install
    ```
2.  **Build Web Assets**:
    ```bash
    npm run build
    ```
3.  **Sync Mobile Project**:
    ```bash
    npx cap sync android
    ```
4.  **Run on Android**:
    Open the `android` folder in Android Studio and run the `app` module on your device or emulator.
5. Change code and build and re-run
    ```
    npm run build #build
    npx cap sync android #copy build to android folder
    ```
## 📱 Permissions
The app requires the following permissions for full functionality:
*   `INTERNET`: For P2P communication.
*   `ACCESS_NETWORK_STATE`: For Wi-Fi only mode enforcement.
*   `MANAGE_EXTERNAL_STORAGE`: For saving downloads to user-selected folders (Android 11+).
*   `POST_NOTIFICATIONS`: For the background service status.

---
Created by Niroj. Optimized for performance and user privacy.
