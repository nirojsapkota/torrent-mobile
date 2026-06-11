package com.androidtorrent.client;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.BatteryManager;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import org.libtorrent4j.AddTorrentParams;
import org.libtorrent4j.Priority;
import org.libtorrent4j.SessionManager;
import org.libtorrent4j.TorrentFlags;
import org.libtorrent4j.TorrentHandle;
import org.libtorrent4j.Sha1Hash;
import org.libtorrent4j.swig.session_handle;
import org.libtorrent4j.swig.torrent_handle_vector;
import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class TorrentService extends Service {
    private static final String CHANNEL_ID = "TorrentServiceChannel";
    private final IBinder binder = new TorrentBinder();
    private SessionManager session;
    // Track paused state since libtorrent exposes it as a flag, not a state
    private final Set<String> pausedHashes = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private boolean wifiOnly = false;
    private boolean isWifiConnected = false;
    private boolean batterySaveMode = false;
    private ConnectivityManager.NetworkCallback networkCallback;
    private BroadcastReceiver batteryReceiver;

    public class TorrentBinder extends Binder {
        TorrentService getService() {
            return TorrentService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("OpenTorrent")
                .setContentText("Torrent service is active")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build();
        startForeground(1, notification);

        session = new SessionManager();
        session.start();
        setupNetworkMonitoring();
        setupBatteryMonitoring();
    }

    private void setupBatteryMonitoring() {
        batteryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                applyNetworkPolicy();
            }
        };
        registerReceiver(batteryReceiver, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
    }

    private void setupNetworkMonitoring() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return;

        Network activeNetwork = cm.getActiveNetwork();
        if (activeNetwork != null) {
            NetworkCapabilities caps = cm.getNetworkCapabilities(activeNetwork);
            isWifiConnected = caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
        }

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(network);
                isWifiConnected = caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
                applyNetworkPolicy();
            }

            @Override
            public void onLost(@NonNull Network network) {
                isWifiConnected = false;
                applyNetworkPolicy();
            }

            @Override
            public void onCapabilitiesChanged(@NonNull Network network, @NonNull NetworkCapabilities caps) {
                isWifiConnected = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
                applyNetworkPolicy();
            }
        };

        cm.registerNetworkCallback(
                new NetworkRequest.Builder()
                        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                        .build(),
                networkCallback
        );
    }

    public void setWifiOnly(boolean wifiOnly) {
        this.wifiOnly = wifiOnly;
        applyNetworkPolicy();
    }

    public void setBatterySaveMode(boolean enabled) {
        this.batterySaveMode = enabled;
        applyNetworkPolicy();
    }

    private void applyNetworkPolicy() {
        boolean shouldPause = (wifiOnly && !isWifiConnected) || (batterySaveMode && isBatteryLow());
        
        if (shouldPause) {
            // Pause all torrents if policy dictates
            for (TorrentHandle h : getHandles()) {
                if (h.isValid()) h.pause();
            }
        } else {
            // Resume torrents that were NOT manually paused
            for (TorrentHandle h : getHandles()) {
                if (h.isValid()) {
                    String hash = h.infoHash().toHex();
                    if (!pausedHashes.contains(hash)) {
                        h.resume();
                    }
                }
            }
        }
    }

    private boolean isBatteryLow() {
        IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        Intent batteryStatus = registerReceiver(null, ifilter);
        if (batteryStatus == null) return false;

        int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        float batteryPct = level * 100 / (float)scale;

        int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                             status == BatteryManager.BATTERY_STATUS_FULL;

        return batteryPct <= 20 && !isCharging;
    }

    public void addTorrent(String magnetUri, File saveDir) {
        saveDir.mkdirs();
        try {
            AddTorrentParams params = AddTorrentParams.parseMagnetUri(magnetUri);
            params.swig().setSave_path(saveDir.getAbsolutePath());
            session.swig().async_add_torrent(params.swig());
        } catch (Exception e) {
            // invalid magnet URI
        }
    }

    public List<TorrentHandle> getHandles() {
        torrent_handle_vector v = session.swig().get_torrents();
        List<TorrentHandle> handles = new ArrayList<>();
        int size = (int) v.size();
        for (int i = 0; i < size; i++) {
            TorrentHandle h = new TorrentHandle(v.get(i));
            if (h.isValid()) {
                handles.add(h);
            }
        }
        return handles;
    }

    public void pauseTorrent(String infoHash) {
        TorrentHandle h = session.find(Sha1Hash.parseHex(infoHash));
        if (h != null && h.isValid()) {
            h.pause();
            pausedHashes.add(infoHash);
        }
    }

    public void resumeTorrent(String infoHash) {
        TorrentHandle h = session.find(Sha1Hash.parseHex(infoHash));
        if (h != null && h.isValid()) {
            pausedHashes.remove(infoHash);
            if (!(wifiOnly && !isWifiConnected)) {
                h.resume();
            }
        }
    }

    public boolean isPaused(String infoHash) {
        return pausedHashes.contains(infoHash);
    }

    public void setFilePriority(String infoHash, int fileIndex, String priorityStr) {
        TorrentHandle h = session.find(Sha1Hash.parseHex(infoHash));
        if (h == null || !h.isValid()) return;
        Priority p;
        switch (priorityStr) {
            case "high":   p = Priority.TOP_PRIORITY; break;
            case "low":    p = Priority.LOW; break;
            case "skip":   p = Priority.IGNORE; break;
            default:       p = Priority.DEFAULT; break;
        }
        h.filePriority(fileIndex, p);
    }

    public void setSequentialDownload(String infoHash, boolean sequential) {
        TorrentHandle h = session.find(Sha1Hash.parseHex(infoHash));
        if (h != null && h.isValid()) {
            if (sequential) {
                h.setFlags(TorrentFlags.SEQUENTIAL_DOWNLOAD);
            } else {
                h.unsetFlags(TorrentFlags.SEQUENTIAL_DOWNLOAD);
            }
        }
    }

    public void removeTorrent(String infoHash, boolean withFiles) {
        TorrentHandle h = session.find(Sha1Hash.parseHex(infoHash));
        if (h == null || !h.isValid()) return;
        if (withFiles) {
            session.swig().remove_torrent(h.swig(), session_handle.delete_files);
        } else {
            session.remove(h);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        if (session != null) session.stop();
        if (networkCallback != null) {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm != null) cm.unregisterNetworkCallback(networkCallback);
        }
        if (batteryReceiver != null) {
            unregisterReceiver(batteryReceiver);
        }
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Torrent Service Channel",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }
}
