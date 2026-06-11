package com.androidtorrent.client;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.app.AppPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppPlugin.class);
        registerPlugin(FileExplorerPlugin.class);
        registerPlugin(TorrentPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
