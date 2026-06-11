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
import com.frostwire.jlibtorrent.TorrentStatus;
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
            List<TorrentStatus> statuses = torrentService.getStats();
            JSArray array = new JSArray();
            for (TorrentStatus s : statuses) {
                JSObject obj = new JSObject();
                obj.put("infoHash", s.infoHash().toHex());
                obj.put("name", s.name());
                obj.put("progress", s.progress() * 100);
                obj.put("downloadSpeed", s.downloadRate());
                obj.put("uploadSpeed", s.uploadRate());
                obj.put("downloaded", s.totalDone());
                obj.put("totalSize", s.totalWanted());
                obj.put("status", s.state().toString().toLowerCase());
                obj.put("peersActive", s.numPeers());
                obj.put("seedsActive", s.numSeeds());
                array.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("torrents", array);
            call.resolve(ret);
        } else {
            call.reject("Service not bound");
        }
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
    public void removeTorrent(PluginCall call) {
        String hash = call.getString("infoHash");
        if (isBound && torrentService != null && hash != null) {
            torrentService.removeTorrent(hash);
            call.resolve();
        } else {
            call.reject("Service not bound or hash missing");
        }
    }
}
