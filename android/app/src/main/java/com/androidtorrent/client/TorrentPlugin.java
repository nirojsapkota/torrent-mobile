package com.androidtorrent.client;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.libtorrent4j.TorrentHandle;
import org.libtorrent4j.TorrentInfo;
import org.libtorrent4j.FileStorage;
import org.libtorrent4j.TorrentStatus;
import java.io.File;
import java.util.List;

@CapacitorPlugin(name = "Torrent")
public class TorrentPlugin extends Plugin {
    private TorrentService torrentService;
    private boolean isBound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            TorrentService.TorrentBinder binder = (TorrentService.TorrentBinder) service;
            torrentService = binder.getService();
            isBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            isBound = false;
        }
    };

    @Override
    public void load() {
        Intent intent = new Intent(getContext(), TorrentService.class);
        getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
        getContext().startService(intent);
    }

    @PluginMethod
    public void addTorrent(PluginCall call) {
        String magnetUri = call.getString("magnetUri");
        String path = call.getString("path");
        if (magnetUri == null || path == null) {
            call.reject("magnetUri and path are required");
            return;
        }

        if (isBound && torrentService != null) {
            torrentService.addTorrent(magnetUri, new File(path));
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }

    @PluginMethod
    public void getStats(PluginCall call) {
        if (isBound && torrentService != null) {
            List<TorrentHandle> handles = torrentService.getHandles();
            JSArray array = new JSArray();
            for (TorrentHandle h : handles) {
                if (!h.isValid()) continue;
                // Use QUERY_NAME flag to ensure name is populated in status
                TorrentStatus s = h.status(TorrentHandle.QUERY_NAME);
                String infoHashHex = h.infoHash().toHex();
                boolean isPaused = torrentService.isPaused(infoHashHex);
                String statusStr = isPaused ? "paused" : s.state().toString().toLowerCase();

                // Resolve name: TorrentInfo is most reliable (available post-metadata),
                // fall back to status name, then magnet dn param
                String name = "";
                TorrentInfo ti = h.torrentFile();
                if (ti != null) {
                    name = ti.name();
                }
                if (name == null || name.isEmpty()) {
                    name = s.name();
                }
                JSObject obj = new JSObject();
                obj.put("infoHash", infoHashHex);
                obj.put("name", name);
                obj.put("progress", s.progress() * 100);
                obj.put("downloadSpeed", isPaused ? 0 : s.downloadRate());
                obj.put("uploadSpeed", isPaused ? 0 : s.uploadRate());
                obj.put("downloaded", s.totalDone());
                obj.put("totalSize", s.totalWanted());
                obj.put("status", statusStr);
                obj.put("peersActive", isPaused ? 0 : s.numPeers());
                obj.put("seedsActive", isPaused ? 0 : s.numSeeds());
                obj.put("savePath", h.savePath());
                obj.put("files", buildFileList(h));
                array.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("torrents", array);
            call.resolve(ret);
        } else {
            call.reject("Service not bound");
        }
    }

    private JSArray buildFileList(TorrentHandle h) {
        JSArray files = new JSArray();
        try {
            TorrentInfo ti = h.torrentFile();
            if (ti == null) return files;

            FileStorage fs = ti.files();
            int numFiles = fs.numFiles();
            long[] progress = h.fileProgress(); // returns long[] directly

            for (int i = 0; i < numFiles; i++) {
                JSObject file = new JSObject();
                String fullPath = fs.filePath(i);
                String name = fullPath.contains("/")
                    ? fullPath.substring(fullPath.lastIndexOf('/') + 1)
                    : fullPath;
                long size = fs.fileSize(i);
                long downloaded = (i < progress.length) ? progress[i] : 0;
                file.put("name", name);
                file.put("path", fullPath);
                file.put("index", i);
                file.put("size", size);
                file.put("downloaded", downloaded);
                files.put(file);
            }
        } catch (Exception e) {
            // Metadata not yet available (magnet still resolving)
        }
        return files;
    }

    @PluginMethod
    public void pauseTorrent(PluginCall call) {
        String hash = call.getString("infoHash");
        if (isBound && torrentService != null && hash != null) {
            torrentService.pauseTorrent(hash);
            call.resolve();
        } else {
            call.reject("Service not bound or hash missing");
        }
    }

    @PluginMethod
    public void resumeTorrent(PluginCall call) {
        String hash = call.getString("infoHash");
        if (isBound && torrentService != null && hash != null) {
            torrentService.resumeTorrent(hash);
            call.resolve();
        } else {
            call.reject("Service not bound or hash missing");
        }
    }

    @PluginMethod
    public void setFilePriority(PluginCall call) {
        String hash = call.getString("infoHash");
        Integer fileIndex = call.getInt("fileIndex");
        String priority = call.getString("priority", "normal");
        if (hash == null || fileIndex == null) {
            call.reject("infoHash and fileIndex are required");
            return;
        }
        if (isBound && torrentService != null) {
            torrentService.setFilePriority(hash, fileIndex, priority);
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }

    @PluginMethod
    public void setSequentialDownload(PluginCall call) {
        String hash = call.getString("infoHash");
        Boolean sequential = call.getBoolean("sequential");
        if (hash == null) {
            call.reject("infoHash is required");
            return;
        }
        if (isBound && torrentService != null) {
            torrentService.setSequentialDownload(hash, sequential != null ? sequential : true);
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }

    @PluginMethod
    public void setWifiOnly(PluginCall call) {
        Boolean wifiOnly = call.getBoolean("wifiOnly");
        if (wifiOnly == null) {
            call.reject("wifiOnly is required");
            return;
        }
        if (isBound && torrentService != null) {
            torrentService.setWifiOnly(wifiOnly);
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }

    @PluginMethod
    public void setBatterySaveMode(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("enabled is required");
            return;
        }
        if (isBound && torrentService != null) {
            torrentService.setBatterySaveMode(enabled);
            call.resolve();
        } else {
            call.reject("Service not bound");
        }
    }

    @PluginMethod
    public void removeTorrent(PluginCall call) {
        String hash = call.getString("infoHash");
        Boolean withFiles = call.getBoolean("withFiles", false);
        if (isBound && torrentService != null && hash != null) {
            torrentService.removeTorrent(hash, Boolean.TRUE.equals(withFiles));
            call.resolve();
        } else {
            call.reject("Service not bound or hash missing");
        }
    }
}
