package com.androidtorrent.client;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.app.AppPlugin;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppPlugin.class);
        registerPlugin(FileExplorerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

@CapacitorPlugin(name = "FileExplorer")
class FileExplorerPlugin extends Plugin {

    @PluginMethod
    public void openFolder(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Path is required");
            return;
        }

        try {
            String relativePath = path.replace("/storage/emulated/0/", "").replace("/storage/emulated/0", "");
            Uri uri = Uri.parse("content://com.android.externalstorage.documents/document/primary:" + relativePath);
            
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "vnd.android.document/directory");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception ex) {
                call.reject("Could not open file explorer: " + ex.getLocalizedMessage());
            }
        }
    }
}
