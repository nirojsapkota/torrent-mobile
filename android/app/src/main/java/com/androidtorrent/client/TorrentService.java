package com.androidtorrent.client;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import com.frostwire.jlibtorrent.AlertListener;
import com.frostwire.jlibtorrent.SessionManager;
import com.frostwire.jlibtorrent.TorrentHandle;
import com.frostwire.jlibtorrent.TorrentStatus;
import com.frostwire.jlibtorrent.alerts.Alert;
import com.frostwire.jlibtorrent.alerts.AlertType;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class TorrentService extends Service {
    private static final String CHANNEL_ID = "TorrentServiceChannel";
    private final IBinder binder = new TorrentBinder();
    private SessionManager session;

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
    }

    public void addTorrent(String magnetUri, File saveDir) {
        session.download(magnetUri, saveDir);
    }

    public List<TorrentStatus> getStats() {
        List<TorrentHandle> handles = session.handles();
        List<TorrentStatus> stats = new ArrayList<>();
        for (TorrentHandle h : handles) {
            stats.add(h.status());
        }
        return stats;
    }

    public void pauseTorrent(String infoHash) {
        TorrentHandle h = session.find(infoHash);
        if (h != null) h.pause();
    }

    public void resumeTorrent(String infoHash) {
        TorrentHandle h = session.find(infoHash);
        if (h != null) h.resume();
    }

    public void removeTorrent(String infoHash) {
        TorrentHandle h = session.find(infoHash);
        if (h != null) session.remove(h);
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
        session.stop();
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
            manager.createNotificationChannel(serviceChannel);
        }
    }
}
